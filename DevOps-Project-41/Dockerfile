# Use lightweight Nginx alpine image
FROM nginx:alpine

# Copy all static website assets to Nginx default public directory
COPY . /usr/share/nginx/html/

# Expose port 80 for traffic
EXPOSE 80

# Start Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
