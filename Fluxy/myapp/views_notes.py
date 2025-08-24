# views.py
from rest_framework import generics, permissions
from .models import NoteTab
from .serializers import NoteTabSerializer

# List all notes for the logged-in user or create a new note
class NoteTabListCreateView(generics.ListCreateAPIView):
    serializer_class = NoteTabSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return NoteTab.objects.filter(user=self.request.user).order_by('order')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

# Retrieve, update, or delete a specific note
class NoteTabDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = NoteTabSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return NoteTab.objects.filter(user=self.request.user)
