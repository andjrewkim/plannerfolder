# views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from datetime import timedelta, date
from .models import UserStreak, DailyActivity
from .serializers import UserStreakSerializer, DailyActivitySerializer


def get_week_activity(user, today):
    """Helper to get week activity array (Sunday to Saturday of current calendar week)"""
    # Calculate current week's Sunday
    days_since_sunday = (today.weekday() + 1) % 7
    week_start = today - timedelta(days=days_since_sunday)
    week_end = week_start + timedelta(days=6)

    # Get activities for the current week only
    week_activities = DailyActivity.objects.filter(
        user=user,
        date__gte=week_start,
        date__lte=week_end
    ).order_by('date')

    # Build activity dictionary
    activity_dict = {activity.date: activity.is_complete for activity in week_activities}

    # Create array for Sun-Sat
    week_activity = []
    for i in range(7):
        day = week_start + timedelta(days=i)
        week_activity.append(activity_dict.get(day, False))
    
    return week_activity


class StreakDataView(APIView):
    """
    GET endpoint to retrieve current streak data for the authenticated user
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        today = timezone.now().date()
        
        try:
            # Get or create user streak
            streak, created = UserStreak.objects.get_or_create(user=user)
            
            # Get today's activity
            today_activity = DailyActivity.objects.filter(
                user=user,
                date=today
            ).first()
            
            # Check if user has already updated streak today
            has_updated_today = streak.last_active_date == today
            
            # Get week activity
            week_activity = get_week_activity(user, today)
            
            # Calculate if streak is "lit" (user completed today's assignments)
            is_lit = has_updated_today or (today_activity.is_complete if today_activity else False)
            
            data = {
                'currentStreak': streak.current_streak,
                'maxStreak': streak.longest_streak if streak.longest_streak > 0 else 7,
                'assignmentsCompletedToday': today_activity.assignments_completed if today_activity else 0,
                'totalAssignmentsToday': today_activity.total_assignments if today_activity else 0,
                'weekActivity': week_activity,
                'isLit': is_lit,
                'hasUpdatedToday': has_updated_today,
                'lastUpdateDate': streak.last_active_date.isoformat() if streak.last_active_date else None,
            }
            
            return Response(data, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"❌ Error in StreakDataView: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({
                'error': str(e),
                'currentStreak': 0,
                'maxStreak': 7,
                'weekActivity': [False] * 7,
                'isLit': False,
                'lastUpdateDate': None,
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UpdateStreakView(APIView):
    """
    POST endpoint to update streak when user completes an action
    This should be called from other components when a streak-worthy action occurs
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        today = timezone.now().date()
        
        try:
            # Get or create user streak
            streak, created = UserStreak.objects.get_or_create(user=user)
            
            # Check if already updated today - PREVENT DOUBLE UPDATES
            if streak.last_active_date == today:
                print(f"⏭️ Streak already updated today for {user.email}")
                
                # Still return success with current data
                today_activity = DailyActivity.objects.filter(user=user, date=today).first()
                
                return Response({
                    'success': True,
                    'message': 'Already updated today',
                    'currentStreak': streak.current_streak,
                    'longestStreak': streak.longest_streak,
                    'assignmentsCompleted': today_activity.assignments_completed if today_activity else 0,
                    'totalAssignments': today_activity.total_assignments if today_activity else 0,
                    'isComplete': today_activity.is_complete if today_activity else False,
                    'lastUpdateDate': streak.last_active_date.isoformat(),
                    'weekActivity': get_week_activity(user, today),
                }, status=status.HTTP_200_OK)
            
            print(f"✅ Updating streak for {user.email}")
            print(f"   Before: current_streak={streak.current_streak}, last_active={streak.last_active_date}")
            
            # Update the streak using YOUR model's method
            streak.update_streak()
            
            # Refresh from database to get updated values
            streak.refresh_from_db()
            
            print(f"   After: current_streak={streak.current_streak}, last_active={streak.last_active_date}")
            
            # Get or create today's activity
            daily_activity, activity_created = DailyActivity.objects.get_or_create(
                user=user,
                date=today,
                defaults={
                    'assignments_completed': 1,
                    'total_assignments': 1,
                    'is_complete': True,
                }
            )

            # Update assignments completed if not created
            if not activity_created:
                daily_activity.assignments_completed += 1
                daily_activity.total_assignments = max(daily_activity.total_assignments, daily_activity.assignments_completed)
                daily_activity.save()

            # NOW get week activity AFTER the database has been updated
            week_activity = get_week_activity(user, today)

            print(f"🎉 Streak updated successfully: {streak.current_streak} days")

            return Response({
                'success': True,
                'currentStreak': streak.current_streak,
                'longestStreak': streak.longest_streak,
                'assignmentsCompleted': daily_activity.assignments_completed,
                'totalAssignments': daily_activity.total_assignments,
                'isComplete': daily_activity.is_complete,
                'lastUpdateDate': streak.last_active_date.isoformat(),
                'weekActivity': week_activity,
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"❌ Error in UpdateStreakView: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({
                'error': str(e),
                'success': False,
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class DailyActivityView(APIView):
    """
    GET: Retrieve daily activities for a date range
    POST: Create or update daily activity
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        
        try:
            # Get date range from query params (default to last 30 days)
            days = int(request.query_params.get('days', 30))
            end_date = timezone.now().date()
            start_date = end_date - timedelta(days=days-1)
            
            activities = DailyActivity.objects.filter(
                user=user,
                date__gte=start_date,
                date__lte=end_date
            ).order_by('-date')
            
            serializer = DailyActivitySerializer(activities, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"❌ Error in DailyActivityView GET: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request):
        user = request.user
        
        try:
            date_str = request.data.get('date')
            if date_str:
                activity_date = timezone.datetime.strptime(date_str, '%Y-%m-%d').date()
            else:
                activity_date = timezone.now().date()
            
            daily_activity, created = DailyActivity.objects.update_or_create(
                user=user,
                date=activity_date,
                defaults={
                    'assignments_completed': request.data.get('assignments_completed', 0),
                    'total_assignments': request.data.get('total_assignments', 0),
                }
            )
            
            serializer = DailyActivitySerializer(daily_activity)
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"❌ Error in DailyActivityView POST: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class StreakStatsView(APIView):
    """
    GET endpoint to retrieve overall streak statistics
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        
        try:
            streak = UserStreak.objects.filter(user=user).first()
            
            if not streak:
                return Response({
                    'currentStreak': 0,
                    'longestStreak': 0,
                    'lastActiveDate': None,
                    'totalActiveDays': 0,
                }, status=status.HTTP_200_OK)
            
            # Count total active days
            total_active_days = DailyActivity.objects.filter(
                user=user,
                is_complete=True
            ).count()
            
            return Response({
                'currentStreak': streak.current_streak,
                'longestStreak': streak.longest_streak,
                'lastActiveDate': streak.last_active_date.isoformat() if streak.last_active_date else None,
                'totalActiveDays': total_active_days,
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f"❌ Error in StreakStatsView: {str(e)}")
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)