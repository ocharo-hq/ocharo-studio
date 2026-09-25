# Backend guidelines

*Last updated: 2026-09-25*

Apply shared wow-two .NET conventions and the SDK's current contracts.
The backend contains API, Application, Domain, and test projects. It exposes studio capability metadata and has no
database, Persistence project, Infrastructure project, greeting vertical, account store, or design-document store.
Do not build commerce, authentication, or hosted design storage until the product requires them.
Use `UzbekStudio.BackendServices.slnx` as the solution entry point.
