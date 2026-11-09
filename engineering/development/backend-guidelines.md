# Backend guidelines

*Last updated: 2026-11-09*

Apply shared wow-two .NET conventions and the SDK's current contracts.
The backend contains API, Application, Domain, Persistence, and test projects. PostgreSQL (schema `studio`) stores the complete studio state
under a Platform member-and-organization workspace UUID with atomic revision comparison. Application validation owns request bounds,
document schemas, and the generated garment/material contract; Persistence owns PostgreSQL access, the `studio` migration set and stored JSON.
The workspace header is not an account, authentication credential, or authorization claim.
Studio reads a session from Ocharo's Identity for protected state; accounts belong to Identity and commerce to Platform.
Use `OcharoStudio.BackendServices.slnx` as the solution entry point.
