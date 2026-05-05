FROM nginx:alpine

# Copy both configs for reference
COPY nginx.dev.conf /etc/nginx/nginx.dev.conf
COPY nginx.prod.conf /etc/nginx/nginx.prod.conf

# Default to production config
RUN cp /etc/nginx/nginx.prod.conf /etc/nginx/nginx.conf

# Create directory for SSL certs
RUN mkdir -p /etc/nginx/ssl

EXPOSE 8000 8443

CMD ["nginx", "-g", "daemon off;"]
