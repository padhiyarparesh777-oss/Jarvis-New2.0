FROM python:3.14.10-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    HOME=/data \
    HOST=0.0.0.0 \
    FCC_OPEN_BROWSER=false

RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv

WORKDIR /opt/free-claude-code
RUN git clone --depth 1 https://github.com/Alishahryar1/free-claude-code.git . \
    && uv pip install --system --no-cache .

EXPOSE 10000
CMD ["fcc-server"]
