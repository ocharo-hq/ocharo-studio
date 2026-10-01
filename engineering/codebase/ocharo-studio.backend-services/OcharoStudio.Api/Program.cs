using OcharoStudio.Api.Configurations;

var builder = WebApplication.CreateBuilder(args);
builder.Configure();

var app = builder.Build();
await app.ConfigureAsync();

app.Run();

public partial class Program;
