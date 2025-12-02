from django.core.management.base import BaseCommand
from django.core.mail import send_mail
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from django.conf import settings
from dotenv import load_dotenv
import time
import os

# Load environment variables
load_dotenv()

User = get_user_model()

class Command(BaseCommand):
    help = 'Send re-engagement emails to inactive users'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Preview emails without sending',
        )
        parser.add_argument(
            '--days',
            type=int,
            default=10,
            help='Number of days of inactivity (default: 30)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        inactive_days = options['days']
        
        subject = "Still here when you need us"
        
        html_message = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {{
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f5f5f5;
        }}
        .email-container {{
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 4px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }}
        .header {{
            background-color: #f8fafb;
            border-bottom: 2px solid #e8f2f7;
            padding: 24px 20px;
            text-align: center;
        }}
        .header h1 {{
            margin: 0;
            color: #1a1a1a;
            font-size: 24px;
            font-weight: 600;
        }}
        .content {{
            padding: 24px 20px;
            color: #333333;
            line-height: 1.5;
        }}
        .content p {{
            margin: 0 0 14px 0;
            font-size: 15px;
        }}
        .feature-box {{
            background-color: #f8fafb;
            border-left: 3px solid #4a90e2;
            padding: 16px;
            margin: 18px 0;
        }}
        .feature-box p {{
            margin: 6px 0;
            font-size: 14px;
            color: #555555;
        }}
        .cta-button {{
            display: inline-block;
            background-color: #4a90e2;
            color: #ffffff !important;
            padding: 12px 28px;
            text-decoration: none;
            border-radius: 4px;
            font-weight: 500;
            margin: 16px 0;
            font-size: 15px;
        }}
        .footer {{
            padding: 20px;
            text-align: center;
            color: #888888;
            font-size: 13px;
            border-top: 1px solid #eeeeee;
        }}
        .footer p {{
            margin: 6px 0;
        }}
        .footer a {{
            color: #4a90e2;
            text-decoration: none;
        }}
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>Still here when you need us</h1>
        </div>
        
        <div class="content">
            <p>{greeting}</p>
            
            <p>We noticed you haven't checked your planner in a while. Just wanted to let you know it's still here waiting for you.</p>
            
            <p>Life gets busy. School gets overwhelming. That's exactly when having a place to organize your thoughts helps the most.</p>
            
            <div class="feature-box">
                <p><strong>Your planner helps you:</strong></p>
                <p>• Clear your mind</p>
                <p>• Stop being overwhelmed</p>
                <p>• Break down tasks into manageable pieces</p>
                <p>• Stop procrastinating and work faster</p>
            </div>
            
            <p>Whenever you're ready to come back, we're here.</p>
            
            <center>
                <a href="https://fluxplanner.netlify.app" class="cta-button">Open Your Planner</a>
            </center>
        </div>
        
        <div class="footer">
            <p>Your school organization tool</p>
            <p><a href="https://fluxplanner.netlify.app/unsubscribe?email={email}">Unsubscribe from these emails</a></p>
        </div>
    </div>
</body>
</html>
"""
        
        plain_message = """
{greeting}

We noticed you haven't checked your planner in a bit. Just wanted to let you know it's still here waiting for you.

Life gets busy. School gets overwhelming. That's exactly when having a place to organize your thoughts helps the most.

Your planner helps you:
• Stay organized without the chaos
• Reduce stress by getting it out of your head
• Break down tasks into manageable pieces
• No deadlines or pressure, just clarity

Whenever you're ready to come back, we're here.

Open your planner: https://fluxplanner.netlify.app

---
Your school organization tool
Unsubscribe: https://fluxplanner.netlify.app/unsubscribe?email={email}

"""
        
        # Filter for inactive users only (who haven't opted out)
        cutoff_date = timezone.now() - timedelta(days=inactive_days)
        
        # Check if email_notifications field exists
        if hasattr(User, 'email_notifications'):
            inactive_users = User.objects.filter(
                last_login__lt=cutoff_date,
                email_notifications=True
            ).exclude(email='').exclude(email__isnull=True)
        else:
            self.stdout.write(self.style.WARNING(
                'Warning: email_notifications field not found. Sending to all inactive users.'
            ))
            inactive_users = User.objects.filter(
                last_login__lt=cutoff_date
            ).exclude(email='').exclude(email__isnull=True)
        
        self.stdout.write(
            f"{'[DRY RUN] ' if dry_run else ''}Found {inactive_users.count()} "
            f"inactive users (no login in {inactive_days}+ days)"
        )
        self.stdout.write(f"Cutoff date: {cutoff_date.strftime('%Y-%m-%d %H:%M')}")
        
        if inactive_users.count() == 0:
            self.stdout.write(self.style.SUCCESS("No inactive users to email. Exiting."))
            return
        
        # Show preview of who will receive emails
        self.stdout.write("\nUsers who will receive emails:")
        for user in inactive_users[:5]:
            last_login = user.last_login.strftime('%Y-%m-%d') if user.last_login else 'Never'
            self.stdout.write(f"  - {user.email} (last login: {last_login})")
        
        if inactive_users.count() > 5:
            self.stdout.write(f"  ... and {inactive_users.count() - 5} more")
        
        # Safety confirmation
        if not dry_run:
            confirm = input(f"\nSend emails to {inactive_users.count()} users? Type 'yes' to confirm: ")
            if confirm.lower() != 'yes':
                self.stdout.write(self.style.WARNING("Cancelled."))
                return
        
        # Send emails with error handling
        success_count = 0
        failed_count = 0
        failed_emails = []
        
        from_email = os.getenv('EMAIL_HOST_USER')
        
        for user in inactive_users:
            if not user.email:
                continue
            
            # Personalize the greeting
            greeting = f"Hey {user.first_name}," if user.first_name else "Hey,"
            
            # Update the HTML and plain messages with personalization
            personalized_html = html_message.format(greeting=greeting, email=user.email)
            personalized_plain = plain_message.format(greeting=greeting, email=user.email)
            
            try:
                if not dry_run:
                    send_mail(
                        subject, 
                        personalized_plain,
                        from_email, 
                        [user.email],
                        html_message=personalized_html,
                        fail_silently=False
                    )
                    time.sleep(1)  # Rate limiting
                
                self.stdout.write(
                    f"{'[DRY RUN] Would send' if dry_run else '✓ Sent'} email to {user.email}"
                )
                success_count += 1
                
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f"✗ Failed to send to {user.email}: {str(e)}")
                )
                failed_count += 1
                failed_emails.append((user.email, str(e)))
        
        # Summary
        self.stdout.write(f"\n{'--- DRY RUN SUMMARY ---' if dry_run else '--- SUMMARY ---'}")
        self.stdout.write(f"{'Would send' if dry_run else 'Sent'}: {success_count}")
        self.stdout.write(f"Failed: {failed_count}")
        
        if failed_emails:
            self.stdout.write("\nFailed emails:")
            for email, error in failed_emails:
                self.stdout.write(f"  - {email}: {error}")
        
        if dry_run:
            self.stdout.write(
                self.style.SUCCESS("\n💡 Run without --dry-run to actually send emails")
            )