using System.Xml.Linq;
using Microsoft.AspNetCore.DataProtection.Repositories;
using Npgsql;

namespace OcharoStudio.Persistence;

/// <summary>Keeps the Data Protection key ring in <c>studio.data_protection_keys</c>, so every Studio replica shares one
/// ring and a container replacement keeps every cookie.</summary>
/// <remarks>The key manager calls it outside requests and synchronously; a key already stored under its friendly name is
/// kept as it is.</remarks>
public sealed class PostgresXmlRepository(NpgsqlDataSource dataSource) : IXmlRepository
{
    public IReadOnlyCollection<XElement> GetAllElements()
    {
        using var command = dataSource.CreateCommand("SELECT xml FROM studio.data_protection_keys ORDER BY id");
        using var reader = command.ExecuteReader();
        var elements = new List<XElement>();
        while (reader.Read())
            elements.Add(XElement.Parse(reader.GetString(0)));
        return elements;
    }

    public void StoreElement(XElement element, string friendlyName)
    {
        ArgumentNullException.ThrowIfNull(element);
        using var command = dataSource.CreateCommand(
            "INSERT INTO studio.data_protection_keys (friendly_name, xml) VALUES ($1, $2) ON CONFLICT (friendly_name) DO NOTHING");
        command.Parameters.AddWithValue(friendlyName);
        command.Parameters.AddWithValue(element.ToString(SaveOptions.DisableFormatting));
        command.ExecuteNonQuery();
    }
}
