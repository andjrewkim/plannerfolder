from django.core.management.base import BaseCommand
from django.core.mail import send_mail
from dotenv import load_dotenv
from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
load_dotenv(BASE_DIR / '.env')

class Command(BaseCommand):
    help = 'Send a test email to yourself'

    def add_arguments(self, parser):
        parser.add_argument('email', type=str, help='Your email address')
        parser.add_argument('--name', type=str, default='', help='Optional first name for personalization')

    def handle(self, *args, **options):
        import sys
        import traceback
        
        # Debug: Print stack trace t o see where this is being called from
        print(f"\n=== COMMAND STARTING (PID: {os.getpid()}) ===")
        print("Call stack:")
        traceback.print_stack()
        print("=== END STACK ===\n")
        
        test_email = options['email']
        first_name = options['name']
        
        subject = "Still here when you need us"
        
        # Personalize the greeting
        greeting = f"Hey {first_name}," if first_name else "Hey,"
        
        html_message = f"""
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
            <p><a href="https://fluxplanner.netlify.app/unsubscribe?email={test_email}">Unsubscribe from these emails</a></p>
        </div>
    </div>
</body>
</html>
"""
        
        plain_message = f"""
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
Unsubscribe: https://fluxplanner.netlify.app/unsubscribe?email={test_email}
"""
        
        from_email = os.getenv('EMAIL_HOST_USER')
        
        if not from_email:
            self.stdout.write(self.style.ERROR('EMAIL_HOST_USER not set in .env file'))
            return
        
        try:
            send_mail(
                subject,
                plain_message,
                from_email,
                [test_email],
                html_message=html_message,
                fail_silently=False
            )
            self.stdout.write(self.style.SUCCESS(f'✓ Test email sent to {test_email}'))
            self.stdout.write('')
            self.stdout.write('Next steps:')
            self.stdout.write('1. Check your inbox (and spam folder)')
            self.stdout.write('2. Click the unsubscribe link')
            self.stdout.write('3. Test the unsubscribe button works')
            self.stdout.write('4. Verify you see the success page')
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'✗ Failed to send: {str(e)}'))
            self.stdout.write('')
            self.stdout.write('Common issues:')
            self.stdout.write('- Check EMAIL_HOST_PASSWORD is set correctly in .env')
            self.stdout.write('- Make sure you\'re using a Gmail App Password, not regular password')
            self.stdout.write('- Verify 2-Step Verification is enabled on your Google account')