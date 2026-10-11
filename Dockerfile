FROM python:3.12-slim

WORKDIR /app
COPY . .

ENV PYTHONUNBUFFERED=1
EXPOSE 7860

CMD ["python", "server.py"]
