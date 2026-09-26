# PadelLifeHub

Angular personal productivity and finance application with an Express/Mongoose backend, authenticated records, reports, and optional integrations.


## Development documentation

- [Development pipeline](docs/development-pipeline.md) — code-grounded flow, source map, declared commands, validation plan, and current limitations.

## Local development

The application is split into an Angular frontend and an Express backend. Run the following commands from their respective directories after configuring the required environment variables:

| Component | Install | Start |
| --- | --- | --- |
| Frontend | `cd frontend && npm install` | `npm run start` |
| Backend | `cd backend && npm install` | `npm run dev` |

For available test and build commands, authentication and finance validation considerations, and the release checklist, see the [development pipeline](docs/development-pipeline.md). Do not commit local `.env` files or credentials.
