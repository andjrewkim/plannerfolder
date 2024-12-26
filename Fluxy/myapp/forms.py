from django import forms

class UserInputForm(forms.Form):
    user_input = forms.CharField(
        label='Enter your text',
        widget=forms.Textarea(
            attrs={
                'class': 'custom-textarea',  # Add a custom class for styling
                'placeholder': 'Enter your text...',  # Add a placeholder
                'rows': 3,  # Default number of rows (adjust as needed)
                'cols': 40,  # Default number of columns (adjust as needed)
                'style': 'resize: vertical; width: 200px; height: 10px;',  # CSS styles for initial size and scalability
            }
        )
    )
