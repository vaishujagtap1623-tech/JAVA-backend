# Java Studio Java Backend

This service is the real execution layer. Deploy it separately from the Next.js/Vercel frontend (Docker/Railway/Render/VPS).

- `GET /api/health` checks the service.
- `POST /api/execute` compiles and runs a Java file with OpenJDK 17.
- JSP/Servlet projects should use the web-project runner in the production backend.

Important: Vercel is the frontend/API gateway; it is not a Tomcat host. For real JSP/Servlet execution, deploy a Tomcat-capable backend and set `JAVA_BACKEND_URL` in Vercel.

Do not expose an unrestricted arbitrary-code runner publicly without authentication, CPU/memory limits, filesystem isolation, network restrictions and per-user quotas.
