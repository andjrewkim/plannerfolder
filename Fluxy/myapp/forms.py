from django import forms

class UserInputForm(forms.Form):
    user_input = forms.CharField(label='Enter your text', widget=forms.Textarea)
