from django.http import HttpResponse


class HealthCheckMiddleware:
    """Answers /healthz before anything reads the Host header.

    Load balancer health checks call the container by IP address, which isn't in
    ALLOWED_HOSTS. This liveness check needs no host, database or auth, so it runs
    first. /api/health/ is the full check that also touches the database.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path == "/healthz":
            return HttpResponse("ok", content_type="text/plain")
        return self.get_response(request)
