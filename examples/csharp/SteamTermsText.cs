using System.Text;
using Sudomimus.Native;

namespace Sudomimus.Examples;

internal static class SteamTermsText
{
    internal static string Render(NativeLegalAgreementLocale snapshot)
    {
        var text = new StringBuilder();
        text.AppendLine(snapshot.Document.Title);
        text.AppendLine(snapshot.VersionUrl);
        foreach (var section in snapshot.Document.Sections)
        {
            text.AppendLine();
            text.AppendLine(section.Heading);
            foreach (var paragraph in section.Paragraphs)
            {
                text.AppendLine(paragraph);
                text.AppendLine();
            }

            if (section.Table is { } table)
            {
                text.AppendLine(table.Caption);
                text.AppendLine(string.Join(" | ", table.Columns));
                foreach (var row in table.Rows)
                {
                    text.AppendLine(string.Join(" | ", row.Select(FormatCell)));
                }
                text.AppendLine(table.Footer);
            }

            if (section.Link is { } link)
            {
                text.AppendLine($"{link.Label} ({link.Url})");
            }
        }
        return text.ToString();
    }

    private static string FormatCell(NativeLegalAgreementCell cell) =>
        cell.Url is { } url ? $"{cell.Text} ({url})" : cell.Text;
}
