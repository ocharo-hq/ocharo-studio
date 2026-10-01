# Backend guidelines

*Last updated: 2026-09-26*

Apply shared wow-two .NET conventions and the SDK's current contracts.
The backend contains API, Application, Domain, Persistence, and test projects. SQLite stores the complete studio state
under a Platform member-and-organization workspace UUID with atomic revision comparison. Application validation owns request bounds,
document schemas, and the generated garment/material contract; Persistence owns SQLite access and stored JSON.
The workspace header is not an account, authentication credential, or authorization claim.
Studio consumes Platform audience tickets for protected state; account storage and commerce remain Platform responsibilities.
Reject bearer credentials over HTTP and preserve TLS verification for Platform introspection.
Use `OcharoStudio.BackendServices.slnx` as the solution entry point.
