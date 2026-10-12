FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt requirements-dev.txt ./
ARG INSTALL_DEV=false
# Development images also get gettext so translations can be updated (makemessages).
RUN if [ "$INSTALL_DEV" = "true" ]; then \
        apt-get update && apt-get install -y --no-install-recommends gettext \
        && rm -rf /var/lib/apt/lists/* && pip install -r requirements-dev.txt; \
    else pip install -r requirements.txt; fi

COPY . .
RUN DJANGO_DEBUG=true DB_ENGINE=sqlite python manage.py collectstatic --noinput

RUN useradd --create-home appuser
USER appuser

EXPOSE 8000
# One process with threads keeps the Prometheus metrics in a single registry.
CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 1 --threads 8 --access-logfile -"]
