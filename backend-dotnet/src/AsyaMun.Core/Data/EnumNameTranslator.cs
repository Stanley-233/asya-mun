using Npgsql;

namespace AsyaMun.Core.Data;

public class EnumNameTranslator : INpgsqlNameTranslator
{
    public static readonly EnumNameTranslator Instance = new();

    public string TranslateMemberName(string clrName) => clrName;

    public string TranslateTypeName(string clrName) => clrName;
}