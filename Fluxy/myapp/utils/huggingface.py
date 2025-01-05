import requests

api_token = "REDACTED"
api_url = "https://api-inference.huggingface.co/models/jinaai/jina-embeddings-v3"

headers = {
    "Authorization": f"Bearer {api_token}"
}

def get_model_output(input_text):
    """
    Sends a prompt to the Hugging Face API to extract and interpret event/task info.
    The model should categorize the text, identify the event or task type, 
    and extract time, date, and description details.
    """
    prompt = f"Extract the schedule details from the following text. Extract the name, time, date.\nInput: {input_text}\nOutput:"

    data = {"inputs": prompt}
    
    try:
        response = requests.post(api_url, headers=headers, json=data)
        response.raise_for_status()  # Raise an exception for bad status codes
        return response.json()  # Return AI model's interpretation
    except requests.exceptions.RequestException as e:
        return {"error": str(e)}  # Return error message if something goes wrong
