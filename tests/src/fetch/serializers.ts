import {
    describe,
    it,
    expect
} from 'vitest'

import {
    endpointSerializer,
    requestSerializer
} from '../../../packages/fetch/src/serializers/index.ts';


describe('@logosdx/fetch: serializers', () => {

    describe('endpointSerializer', () => {

        it('should serialize method and pathname', () => {

            const key = endpointSerializer({
                method: 'GET',
                path: '/users/123',
                url: new URL('https://api.example.com/users/123'),
                headers: {}
            });

            expect(key).to.equal('GET|/users/123');
        });

        it('should exclude query parameters', () => {

            const key = endpointSerializer({
                method: 'GET',
                path: '/users',
                url: new URL('https://api.example.com/users?page=1&limit=10'),
                headers: {}
            });

            expect(key).to.equal('GET|/users');
        });

        it('should produce different keys for different methods', () => {

            const url = new URL('https://api.example.com/users');

            const getKey = endpointSerializer({
                method: 'GET',
                path: '/users',
                url,
                headers: {}
            });

            const postKey = endpointSerializer({
                method: 'POST',
                path: '/users',
                url,
                headers: {}
            });

            expect(getKey).to.not.equal(postKey);
            expect(getKey).to.equal('GET|/users');
            expect(postKey).to.equal('POST|/users');
        });

        it('should produce different keys for different paths', () => {

            const key1 = endpointSerializer({
                method: 'GET',
                path: '/users',
                url: new URL('https://api.example.com/users'),
                headers: {}
            });

            const key2 = endpointSerializer({
                method: 'GET',
                path: '/posts',
                url: new URL('https://api.example.com/posts'),
                headers: {}
            });

            expect(key1).to.not.equal(key2);
        });

        it('should be deterministic', () => {

            const ctx = {
                method: 'GET',
                path: '/users/123',
                url: new URL('https://api.example.com/users/123?page=1'),
                headers: { Authorization: 'Bearer token' }
            };

            const key1 = endpointSerializer(ctx);
            const key2 = endpointSerializer(ctx);

            expect(key1).to.equal(key2);
        });

        it('should ignore headers', () => {

            const url = new URL('https://api.example.com/users');

            const key1 = endpointSerializer({
                method: 'GET',
                path: '/users',
                url,
                headers: { Authorization: 'Bearer token1' }
            });

            const key2 = endpointSerializer({
                method: 'GET',
                path: '/users',
                url,
                headers: { Authorization: 'Bearer token2' }
            });

            expect(key1).to.equal(key2);
        });

        it('should ignore payload', () => {

            const url = new URL('https://api.example.com/users');

            const key1 = endpointSerializer({
                method: 'POST',
                path: '/users',
                url,
                headers: {},
                payload: { name: 'John' }
            });

            const key2 = endpointSerializer({
                method: 'POST',
                path: '/users',
                url,
                headers: {},
                payload: { name: 'Jane' }
            });

            expect(key1).to.equal(key2);
        });
    });

    describe('requestSerializer', () => {

        it('should serialize method, path, and query params', () => {

            const key = requestSerializer({
                method: 'GET',
                path: '/users',
                url: new URL('https://api.example.com/users?page=1'),
                headers: {}
            });

            expect(key).to.include('GET');
            expect(key).to.include('/users?page=1');
        });

        it('should include payload in serialization', () => {

            const url = new URL('https://api.example.com/users');

            const key1 = requestSerializer({
                method: 'POST',
                path: '/users',
                url,
                headers: {},
                payload: { name: 'John' }
            });

            const key2 = requestSerializer({
                method: 'POST',
                path: '/users',
                url,
                headers: {},
                payload: { name: 'Jane' }
            });

            expect(key1).to.not.equal(key2);
        });

        it('should include stable headers in serialization', () => {

            const url = new URL('https://api.example.com/users');

            const key1 = requestSerializer({
                method: 'GET',
                path: '/users',
                url,
                headers: { Authorization: 'Bearer token1' }
            });

            const key2 = requestSerializer({
                method: 'GET',
                path: '/users',
                url,
                headers: { Authorization: 'Bearer token2' }
            });

            expect(key1).to.not.equal(key2);
        });

        it('should exclude dynamic headers (X-Timestamp)', () => {

            const url = new URL('https://api.example.com/users');

            const key1 = requestSerializer({
                method: 'GET',
                path: '/users',
                url,
                headers: { 'X-Timestamp': '1234567890' }
            });

            const key2 = requestSerializer({
                method: 'GET',
                path: '/users',
                url,
                headers: { 'X-Timestamp': '9876543210' }
            });

            expect(key1).to.equal(key2);
        });

        it('should exclude dynamic headers (X-Request-Id)', () => {

            const url = new URL('https://api.example.com/users');

            const key1 = requestSerializer({
                method: 'GET',
                path: '/users',
                url,
                headers: { 'X-Request-Id': 'abc-123' }
            });

            const key2 = requestSerializer({
                method: 'GET',
                path: '/users',
                url,
                headers: { 'X-Request-Id': 'xyz-789' }
            });

            expect(key1).to.equal(key2);
        });

        it('should be case-insensitive for header keys', () => {

            const url = new URL('https://api.example.com/users');

            const key1 = requestSerializer({
                method: 'GET',
                path: '/users',
                url,
                headers: { 'Authorization': 'Bearer token' }
            });

            const key2 = requestSerializer({
                method: 'GET',
                path: '/users',
                url,
                headers: { 'authorization': 'Bearer token' }
            });

            expect(key1).to.equal(key2);
        });

        it('should include Accept header', () => {

            const url = new URL('https://api.example.com/users');

            const key1 = requestSerializer({
                method: 'GET',
                path: '/users',
                url,
                headers: { Accept: 'application/json' }
            });

            const key2 = requestSerializer({
                method: 'GET',
                path: '/users',
                url,
                headers: { Accept: 'application/xml' }
            });

            expect(key1).to.not.equal(key2);
        });

        it('should include Accept-Language header', () => {

            const url = new URL('https://api.example.com/users');

            const key1 = requestSerializer({
                method: 'GET',
                path: '/users',
                url,
                headers: { 'Accept-Language': 'en-US' }
            });

            const key2 = requestSerializer({
                method: 'GET',
                path: '/users',
                url,
                headers: { 'Accept-Language': 'es-ES' }
            });

            expect(key1).to.not.equal(key2);
        });

        it('should include Content-Type header', () => {

            const url = new URL('https://api.example.com/users');

            const key1 = requestSerializer({
                method: 'POST',
                path: '/users',
                url,
                headers: { 'Content-Type': 'application/json' }
            });

            const key2 = requestSerializer({
                method: 'POST',
                path: '/users',
                url,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            expect(key1).to.not.equal(key2);
        });

        it('should be deterministic', () => {

            const ctx = {
                method: 'GET',
                path: '/users/123',
                url: new URL('https://api.example.com/users/123?page=1'),
                headers: { Authorization: 'Bearer token' },
                payload: { data: 'test' }
            };

            const key1 = requestSerializer(ctx);
            const key2 = requestSerializer(ctx);

            expect(key1).to.equal(key2);
        });

        it('should handle undefined headers', () => {

            const key = requestSerializer({
                method: 'GET',
                path: '/users',
                url: new URL('https://api.example.com/users'),
                headers: undefined as any
            });

            expect(key).to.be.a('string');
            expect(key).to.include('GET');
        });

        it('should handle empty headers', () => {

            const key = requestSerializer({
                method: 'GET',
                path: '/users',
                url: new URL('https://api.example.com/users'),
                headers: {}
            });

            expect(key).to.be.a('string');
            expect(key).to.include('GET');
        });

        it('should exclude URL hash fragment', () => {

            const key1 = requestSerializer({
                method: 'GET',
                path: '/users',
                url: new URL('https://api.example.com/users#section1'),
                headers: {}
            });

            const key2 = requestSerializer({
                method: 'GET',
                path: '/users',
                url: new URL('https://api.example.com/users#section2'),
                headers: {}
            });

            expect(key1).to.equal(key2);
        });

        it('should differentiate by query parameters', () => {

            const key1 = requestSerializer({
                method: 'GET',
                path: '/users',
                url: new URL('https://api.example.com/users?page=1'),
                headers: {}
            });

            const key2 = requestSerializer({
                method: 'GET',
                path: '/users',
                url: new URL('https://api.example.com/users?page=2'),
                headers: {}
            });

            expect(key1).to.not.equal(key2);
        });

        it('should produce different keys for different methods', () => {

            const url = new URL('https://api.example.com/users');

            const getKey = requestSerializer({
                method: 'GET',
                path: '/users',
                url,
                headers: {}
            });

            const postKey = requestSerializer({
                method: 'POST',
                path: '/users',
                url,
                headers: {}
            });

            expect(getKey).to.not.equal(postKey);
        });
    });
});
