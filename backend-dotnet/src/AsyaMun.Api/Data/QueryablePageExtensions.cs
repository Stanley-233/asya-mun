using System.Linq.Expressions;
using System.Reflection;
using AsyaMun.Api.Dtos;
using Microsoft.EntityFrameworkCore;

namespace AsyaMun.Api.Data;

public static class QueryablePageExtensions
{
    public static async Task<Page<T>> ToPageAsync<T>(this IQueryable<T> source, PageInput input, CancellationToken ct = default)
    {
        var query = source;
        if (input.Sort.Count > 0)
        {
            query = query.ApplySort(input.Sort);
        }

        var total = await query.CountAsync(ct);
        var content = await query
            .Skip(input.Page * input.Size)
            .Take(input.Size)
            .ToListAsync(ct);

        return Page<T>.Of(content, input.Page, input.Size, total);
    }

    public static IQueryable<T> ApplySort<T>(this IQueryable<T> source, IReadOnlyList<SortSpec> sorts)
    {
        var query = source;
        var isFirst = true;

        foreach (var spec in sorts)
        {
            query = query.OrderByProperty(spec.Property, spec.Descending, isFirst);
            isFirst = false;
        }

        return query;
    }

    public static IQueryable<T> OrderByProperty<T>(this IQueryable<T> source, string propertyName, bool descending, bool first = true)
    {
        var entityType = typeof(T);
        var property = FindProperty(entityType, propertyName);
        if (property == null)
        {
            return source;
        }

        var parameter = Expression.Parameter(entityType, "x");
        var propertyAccess = Expression.Property(parameter, property);
        var lambda = Expression.Lambda(propertyAccess, parameter);

        var methodName = descending
            ? (first ? "OrderByDescending" : "ThenByDescending")
            : (first ? "OrderBy" : "ThenBy");

        var result = Expression.Call(
            typeof(Queryable),
            methodName,
            new[] { entityType, property.PropertyType },
            source.Expression,
            Expression.Quote(lambda));

        return source.Provider.CreateQuery<T>(result);
    }

    private static PropertyInfo? FindProperty(Type type, string name)
    {
        foreach (var prop in type.GetProperties(BindingFlags.Public | BindingFlags.Instance))
        {
            if (string.Equals(prop.Name, name, StringComparison.OrdinalIgnoreCase))
            {
                return prop;
            }
        }

        return null;
    }
}