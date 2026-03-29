# Finance Agent - OpenAPI Specification

This directory contains the OpenAPI 3.0 specification for the Finance Agent REST API.

## 📄 Files

- **openapi.yaml** - Complete OpenAPI 3.0 specification in YAML format
- Includes all REST endpoints (files, health check)
- Documents WebSocket chat protocol
- Future OAuth 2.0 security schemes

## 🚀 Quick Start

### View Interactive Documentation

**Option 1: Swagger UI (Built-in)**

Start the backend server and navigate to:
```
http://localhost:3001/api-docs
```

**Option 2: VS Code Extension**

1. Install "OpenAPI (Swagger) Editor" extension
2. Open `openapi.yaml`
3. Right-click → "Preview Swagger"

**Option 3: Online Swagger Editor**

1. Go to https://editor.swagger.io/
2. File → Import File → Select `openapi.yaml`

### Access Raw Specification

- YAML: `./openapi.yaml`
- JSON: `http://localhost:3001/api-docs.json` (when server is running)

## 📚 What's Documented

### REST API Endpoints

✅ **Health & Status**
- `GET /` - API welcome
- `GET /health` - Health check with service status

✅ **File Management**
- `POST /api/files` - Upload PDF documents
- `GET /api/files` - List all files
- `DELETE /api/files/{filename}` - Delete file

✅ **WebSocket Chat**
- `GET /api/chat` - WebSocket connection endpoint
- Complete protocol documentation
- Message format specifications
- Client/server message types

### Additional Documentation

- Request/response schemas
- Error responses
- Example payloads
- Authentication (planned for future)

## 🔧 Using the API

### REST API Examples

**Upload a file:**
```bash
curl -X POST http://localhost:3001/api/files \
  -F "file=@financial-report.pdf"
```

**List files:**
```bash
curl http://localhost:3001/api/files
```

**Health check:**
```bash
curl http://localhost:3001/health
```

**Delete file:**
```bash
curl -X DELETE http://localhost:3001/api/files/report.pdf
```

### WebSocket Chat Example

```javascript
const ws = new WebSocket('ws://localhost:3001/api/chat');

ws.onopen = () => {
  // Send message
  ws.send(JSON.stringify({
    type: 'message',
    content: 'What is the total revenue?'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'content') {
    // Streaming response chunk
    process.stdout.write(data.content);
  } else if (data.type === 'message') {
    // Complete response
    console.log('\nComplete:', data.content);
  }
};
```

## 🛠️ Code Generation

Generate client libraries from the OpenAPI spec:

### TypeScript/JavaScript
```bash
npx @openapitools/openapi-generator-cli generate \
  -i openapi.yaml \
  -g typescript-fetch \
  -o ./generated/typescript-client
```

### Python
```bash
openapi-generator-cli generate \
  -i openapi.yaml \
  -g python \
  -o ./generated/python-client
```

### Java
```bash
openapi-generator-cli generate \
  -i openapi.yaml \
  -g java \
  -o ./generated/java-client
```

### Go
```bash
openapi-generator-cli generate \
  -i openapi.yaml \
  -g go \
  -o ./generated/go-client
```

## 🔐 Authentication (Future)

The specification includes OAuth 2.0 security schemes for future implementation:

**Authorization Code Flow** (browser-based apps)
```yaml
flows:
  authorizationCode:
    authorizationUrl: https://your-tenant.authentication.sap.hana.ondemand.com/oauth/authorize
    tokenUrl: https://your-tenant.authentication.sap.hana.ondemand.com/oauth/token
```

**Client Credentials Flow** (service-to-service)
```yaml
flows:
  clientCredentials:
    tokenUrl: https://your-tenant.authentication.sap.hana.ondemand.com/oauth/token
```

Currently, all endpoints are **unauthenticated** for demo purposes.

## 📦 Integration with Tools

### Postman
1. Open Postman
2. Import → Link → Paste: `http://localhost:3001/api-docs.json`
3. Or import `openapi.yaml` directly

### Insomnia
1. Open Insomnia
2. Application → Import/Export → Import Data
3. Select `openapi.yaml`

### VS Code REST Client
Create a `.http` file:
```http
### Health Check
GET http://localhost:3001/health

### Upload File
POST http://localhost:3001/api/files
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary

------WebKitFormBoundary
Content-Disposition: form-data; name="file"; filename="report.pdf"
Content-Type: application/pdf

< ./report.pdf
------WebKitFormBoundary--

### List Files
GET http://localhost:3001/api/files
```

## 🔄 Updating the Specification

When you add or modify API endpoints:

1. **Update openapi.yaml**
   - Add new paths, schemas, or parameters
   - Follow OpenAPI 3.0 specification
   - Include examples and descriptions

2. **Test the changes**
   ```bash
   # Validate the spec
   npx @apidevtools/swagger-cli validate openapi.yaml
   ```

3. **View in Swagger UI**
   - Restart backend server
   - Visit http://localhost:3001/api-docs
   - Test endpoints directly from UI

4. **Update documentation**
   - Keep this README in sync
   - Update code comments

## 🧪 Testing with Swagger UI

Swagger UI (at `/api-docs`) provides:
- Interactive API explorer
- Try-it-out functionality for each endpoint
- Request/response examples
- Schema validation
- Authentication testing (when enabled)

## 📖 OpenAPI Resources

- [OpenAPI 3.0 Specification](https://spec.openapis.org/oas/v3.0.3)
- [Swagger Editor](https://editor.swagger.io/)
- [OpenAPI Generator](https://openapi-generator.tech/)
- [Swagger UI Documentation](https://swagger.io/tools/swagger-ui/)

## 💡 Best Practices

1. **Keep it updated** - Update spec when API changes
2. **Add examples** - Include request/response examples
3. **Document errors** - Specify all possible error responses
4. **Use references** - Reuse schemas with $ref
5. **Validate** - Use swagger-cli to validate changes
6. **Version it** - Follow semantic versioning

## 🚦 Validation

Validate the OpenAPI specification:

```bash
# Install validator
npm install -g @apidevtools/swagger-cli

# Validate
swagger-cli validate openapi.yaml

# Bundle (resolve $ref)
swagger-cli bundle openapi.yaml -o openapi-bundled.yaml
```

## 📊 API Coverage

Current API documentation coverage:

- ✅ All REST endpoints documented
- ✅ Request/response schemas defined
- ✅ Error responses documented
- ✅ WebSocket protocol documented
- ✅ Examples provided
- ✅ Authentication schemes defined (for future)
- ✅ Server URLs configured (dev, local, production)

## 🎯 Future Enhancements

Planned additions to the OpenAPI spec:

- [ ] Add rate limiting headers documentation
- [ ] Include pagination parameters (when implemented)
- [ ] Add webhook documentation (if implemented)
- [ ] Document batch operations
- [ ] Add API versioning strategy
- [ ] Include deprecation notices
- [ ] Add operation IDs for code generation
- [ ] Document caching headers

## 🤝 Contributing

When contributing API changes:

1. Update the OpenAPI spec first (design-first approach)
2. Implement the endpoint to match the spec
3. Test with Swagger UI
4. Update this README if needed
5. Validate the spec before committing

---

**Generated from:** Finance Agent v1.0.0
**OpenAPI Version:** 3.0.3
**Last Updated:** 2024-03-29
