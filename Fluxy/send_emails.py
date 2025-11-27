import os
import django
import time
from django.core.mail import send_mail
from django.contrib.auth import get_user_model
from dotenv import load_dotenv
load_dotenv()

# Setup Django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "Fluxy.settings")
django.setup()

User = get_user_model()

subject = "Still here when you need us"

html_message = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f5f5f5;
        }
        .email-container {
            max-width: 600px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 4px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.08);
        }
        .header {
            background-color: #f8fafb;
            border-bottom: 2px solid #e8f2f7;
            padding: 24px 20px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            color: #1a1a1a;
            font-size: 24px;
            font-weight: 600;
        }
        .content {
            padding: 24px 20px;
            color: #333333;
            line-height: 1.5;
        }
        .content p {
            margin: 0 0 14px 0;
            font-size: 15px;
        }
        .feature-box {
            background-color: #f8fafb;
            border-left: 3px solid #4a90e2;
            padding: 16px;
            margin: 18px 0;
        }
        .feature-box p {
            margin: 6px 0;
            font-size: 14px;
            color: #555555;
        }
        .cta-button {
            display: inline-block;
            background-color: #4a90e2;
            color: #ffffff !important;
            padding: 12px 28px;
            text-decoration: none;
            border-radius: 4px;
            font-weight: 500;
            margin: 16px 0;
            font-size: 15px;
        }
        .footer {
            padding: 20px;
            text-align: center;
            color: #888888;
            font-size: 13px;
            border-top: 1px solid #eeeeee;
        }
        .footer p {
            margin: 6px 0;
        }
        .footer p {
            margin: 8px 0;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>Still here when you need us</h1>
        </div>
        
        <div class="content">
            <p>Hey,</p>
            
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
        </div>
    </div>
</body>
</html>
"""

plain_message = """
Hey,

We noticed you haven't checked your planner in a while. Just wanted to let you know it's still here waiting for you.

Life gets busy. School gets overwhelming. That's exactly when having a place to organize your thoughts helps the most.

Your planner helps you:
• Stay organized without the chaos
• Reduce stress by getting it out of your head
• Break down tasks into manageable pieces
• No deadlines or pressure, just clarity

Whenever you're ready to come back, we're here.

Open your planner: https://fluxplanner.netlify.app

Your school organization tool
"""

from_email = os.getenv('EMAIL_HOST_USER')

for user in User.objects.all():
    if user.email:
        # Personalize the greeting
        greeting = f"Hey {user.first_name}," if user.first_name else "Hey,"
        
        # Update the HTML message with the personalized greeting
        personalized_html = html_message.replace("<p>Hey,</p>", f"<p>{greeting}</p>")
        
        # Update the plain message
        personalized_plain = plain_message.replace("Hey,", greeting)
        
        send_mail(
            subject, 
            personalized_plain,
            from_email, 
            [user.email],
            html_message=personalized_html
        )
        print(f"Sent email to {user.email}")
        time.sleep(1)