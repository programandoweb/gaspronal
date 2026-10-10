# syntax=docker/dockerfile:1

FROM composer:2 AS composer

FROM php:8.2-fpm-alpine

WORKDIR /var/www/html

RUN apk add --no-cache \
    bash \
    curl \
    git \
    openssh-client \
    sudo \
    docker-cli \
    docker-cli-compose \
    freetype-dev \
    icu-dev \
    libjpeg-turbo-dev \
    libpng-dev \
    libwebp-dev \
    libxml2-dev \
    libzip-dev \
    oniguruma-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
    && docker-php-ext-install -j$(nproc) \
        bcmath \
        dom \
        gd \
        intl \
        mbstring \
        opcache \
        pdo_mysql \
        zip \
    && rm -rf /tmp/*

COPY --from=composer /usr/bin/composer /usr/local/bin/composer

COPY docker/php/opcache.ini /usr/local/etc/php/conf.d/99-gaspronal-opcache.ini
COPY . /var/www/html

RUN mkdir -p \
        storage/framework/cache/data \
        storage/framework/sessions \
        storage/framework/views \
        storage/logs \
        bootstrap/cache \
    && composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader \
    && chown -R www-data:www-data storage bootstrap/cache \
    && printf '#!/bin/sh\nexec /bin/bash /var/www/gaspronal.programandoweb.net/scripts/deploy.sh\n' > /usr/local/bin/gaspronal-deploy \
    && chmod 0755 /usr/local/bin/gaspronal-deploy \
    && printf 'www-data ALL=(root) NOPASSWD: /usr/local/bin/gaspronal-deploy\n' > /etc/sudoers.d/gaspronal-deploy \
    && chmod 0440 /etc/sudoers.d/gaspronal-deploy

EXPOSE 9000

CMD ["php-fpm", "-F"]
