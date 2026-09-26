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

## Verify changes locally

Run the relevant checks before merging a change. Use a terminal in each component directory:

| Component | Check | Command |
| --- | --- | --- |
| Backend | Test suite | `cd backend && npm run test` |
| Frontend | Production build | `cd frontend && npm run build` |
| Frontend | Test suite | `cd frontend && npm run test` |

These commands are documented project scripts, not a claim that the tests or build currently pass. For changes involving authentication, finance, or integrations, follow the additional verification gates in the [development pipeline](docs/development-pipeline.md).
