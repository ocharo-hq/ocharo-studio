using OcharoStudio.Api.Configurations;
using OcharoStudio.Api.Studio.Import;
using WoW.Two.Sdk.Beta.Be.Meta;

// Answer a verb, or build, configure and serve the host.
return await ServiceHost.RunAsync(
    args,
    builder => builder.Configure(),
    app => app.ConfigureAsync(),
    verbs => verbs.AddHostVerb(LegacySqliteImportVerb.Name, LegacySqliteImportVerb.RunAsync));

public partial class Program;
