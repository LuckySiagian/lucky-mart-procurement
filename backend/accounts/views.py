from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import PortalTokenObtainPairSerializer, UserSerializer


class LoginView(TokenObtainPairView):
    serializer_class = PortalTokenObtainPairSerializer


@api_view(["GET"])
def me(request):
    return Response(UserSerializer(request.user).data)
