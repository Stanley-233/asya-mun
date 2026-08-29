using System.Globalization;
using System.Text;
using AsyaMun.Api.Models;

namespace AsyaMun.Api.Dtos;

public record TimeAnchorResponse(
    long Id,
    string? ConferenceId,
    DateTime? UpdateTime,
    DateTime? AnchorRealTime,
    string? AnchorGameTime,
    decimal? TimeRatio,
    bool IsCurrent)
{
    public static TimeAnchorResponse From(TimeAnchor anchor)
    {
        return new TimeAnchorResponse(
            anchor.Id,
            anchor.ConferenceId.ToString("D"),
            anchor.UpdateTime,
            anchor.AnchorRealTime,
            GameTimeString.Normalize(anchor.AnchorGameTime),
            anchor.TimeRatio,
            anchor.IsCurrent);
    }
}

public record TimeUpdateRequest(decimal TimeRatio);

public record TimeJumpRequest(string TargetGameTime, decimal TimeRatio);

public record CurrentTimeResponse(string CurrentGameTime);

internal static class GameTimeString
{
    private readonly struct GameTimeParts
    {
        public readonly long Year;
        public readonly int Month;
        public readonly int Day;
        public readonly int Hour;
        public readonly int Minute;
        public readonly int Second;
        public readonly int Nano;

        public GameTimeParts(long year, int month, int day, int hour, int minute, int second, int nano)
        {
            Year = year;
            Month = month;
            Day = day;
            Hour = hour;
            Minute = minute;
            Second = second;
            Nano = nano;
        }
    }

    public static string? Normalize(string? value)
    {
        if (value == null)
        {
            return null;
        }

        return TryParse(value, out var parts) ? Format(parts) : value;
    }

    public static string PlusSeconds(string value, long seconds)
    {
        if (!TryParse(value, out var parts))
        {
            return value;
        }

        return Format(AddSeconds(parts, seconds));
    }

    public static string FromNow(DateTime now)
    {
        var ticks = now.Ticks;
        var fractionTicks = ticks % TimeSpan.TicksPerSecond;
        return Format(new GameTimeParts(
            now.Year,
            now.Month,
            now.Day,
            now.Hour,
            now.Minute,
            now.Second,
            (int)(fractionTicks * 100)));
    }

    private static GameTimeParts AddSeconds(in GameTimeParts parts, long seconds)
    {
        var day = DaysFromCivil(parts.Year, parts.Month, parts.Day);
        var totalSeconds = day * 86400
            + parts.Hour * 3600
            + parts.Minute * 60
            + parts.Second
            + seconds;

        var newDay = FloorDiv(totalSeconds, 86400);
        var secondsOfDay = totalSeconds - newDay * 86400;

        var (year, month, date) = CivilFromDays(newDay);
        return new GameTimeParts(
            year,
            month,
            date,
            (int)(secondsOfDay / 3600),
            (int)(secondsOfDay % 3600 / 60),
            (int)(secondsOfDay % 60),
            parts.Nano);
    }

    private static bool TryParse(string value, out GameTimeParts parts)
    {
        parts = default;
        if (string.IsNullOrEmpty(value))
        {
            return false;
        }

        var index = 0;
        var sign = 1;
        if (value[index] == '-')
        {
            sign = -1;
            index++;
        }
        else if (value[index] == '+')
        {
            sign = 1;
            index++;
        }

        var yearStart = index;
        while (index < value.Length && char.IsAsciiDigit(value[index]))
        {
            index++;
        }

        var yearDigits = index - yearStart;
        if (yearDigits == 0 || yearDigits > 10)
        {
            return false;
        }

        var year = sign * long.Parse(value.AsSpan(yearStart, yearDigits), CultureInfo.InvariantCulture);

        if (!Expect(value, ref index, '-')
            || !TryReadTwoDigits(value, ref index, out var month)
            || !Expect(value, ref index, '-')
            || !TryReadTwoDigits(value, ref index, out var day)
            || !Expect(value, ref index, 'T')
            || !TryReadTwoDigits(value, ref index, out var hour)
            || !Expect(value, ref index, ':')
            || !TryReadTwoDigits(value, ref index, out var minute))
        {
            return false;
        }

        var second = 0;
        if (index < value.Length && value[index] == ':')
        {
            index++;
            if (!TryReadTwoDigits(value, ref index, out second))
            {
                return false;
            }
        }

        var nano = 0;
        if (index < value.Length && value[index] == '.')
        {
            index++;
            var fractionStart = index;
            while (index < value.Length && char.IsAsciiDigit(value[index]))
            {
                index++;
            }

            var fractionDigits = index - fractionStart;
            if (fractionDigits == 0 || fractionDigits > 9)
            {
                return false;
            }

            var fraction = long.Parse(value.AsSpan(fractionStart, fractionDigits), CultureInfo.InvariantCulture);
            for (var i = fractionDigits; i < 9; i++)
            {
                fraction *= 10;
            }

            nano = (int)fraction;
        }

        if (index != value.Length
            || month < 1 || month > 12
            || day < 1 || day > 31
            || hour > 23 || minute > 59 || second > 59)
        {
            return false;
        }

        parts = new GameTimeParts(year, month, day, hour, minute, second, nano);
        return true;
    }

    private static string Format(in GameTimeParts parts)
    {
        var builder = new StringBuilder();
        var year = parts.Year;
        var absYear = Math.Abs(year);
        if (absYear < 1000)
        {
            var padded = year < 0
                ? (year - 10000).ToString(CultureInfo.InvariantCulture)
                : (year + 10000).ToString(CultureInfo.InvariantCulture);
            builder.Append(year < 0 ? padded.Remove(1, 1) : padded.Remove(0, 1));
        }
        else
        {
            if (year > 9999)
            {
                builder.Append('+');
            }

            builder.Append(year.ToString(CultureInfo.InvariantCulture));
        }

        builder.Append(parts.Month < 10 ? "-0" : "-").Append(parts.Month);
        builder.Append(parts.Day < 10 ? "-0" : "-").Append(parts.Day);
        builder.Append('T');
        builder.Append(parts.Hour < 10 ? "0" : string.Empty).Append(parts.Hour);
        builder.Append(parts.Minute < 10 ? ":0" : ":").Append(parts.Minute);

        if (parts.Second > 0 || parts.Nano > 0)
        {
            builder.Append(parts.Second < 10 ? ":0" : ":").Append(parts.Second);
            if (parts.Nano > 0)
            {
                builder.Append('.');
                var nano = parts.Nano;
                if (nano % 1_000_000 == 0)
                {
                    builder.Append(((nano / 1_000_000) + 1000).ToString(CultureInfo.InvariantCulture).Substring(1));
                }
                else if (nano % 1_000 == 0)
                {
                    builder.Append(((nano / 1_000) + 1_000_000).ToString(CultureInfo.InvariantCulture).Substring(1));
                }
                else
                {
                    builder.Append((nano + 1_000_000_000).ToString(CultureInfo.InvariantCulture).Substring(1));
                }
            }
        }

        return builder.ToString();
    }

    private static bool Expect(string value, ref int index, char expected)
    {
        if (index >= value.Length || value[index] != expected)
        {
            return false;
        }

        index++;
        return true;
    }

    private static bool TryReadTwoDigits(string value, ref int index, out int result)
    {
        result = 0;
        if (index + 1 >= value.Length
            || !char.IsAsciiDigit(value[index])
            || !char.IsAsciiDigit(value[index + 1]))
        {
            return false;
        }

        result = (value[index] - '0') * 10 + (value[index + 1] - '0');
        index += 2;
        return true;
    }

    private static long DaysFromCivil(long year, int month, int day)
    {
        var y = year - (month <= 2 ? 1 : 0);
        var era = FloorDiv(y, 400);
        var yearOfEra = y - era * 400;
        var dayOfYear = (153 * (month + (month > 2 ? -3 : 9)) + 2) / 5 + day - 1;
        var dayOfEra = yearOfEra * 365 + yearOfEra / 4 - yearOfEra / 100 + dayOfYear;
        return era * 146097 + dayOfEra - 719468;
    }

    private static (long Year, int Month, int Day) CivilFromDays(long z)
    {
        z += 719468;
        var era = FloorDiv(z, 146097);
        var dayOfEra = z - era * 146097;
        var yearOfEra = (dayOfEra - dayOfEra / 1460 + dayOfEra / 36524 - dayOfEra / 146096) / 365;
        var year = yearOfEra + era * 400;
        var dayOfYear = dayOfEra - (365 * yearOfEra + yearOfEra / 4 - yearOfEra / 100);
        var monthPrime = (5 * dayOfYear + 2) / 153;
        var day = dayOfYear - (153 * monthPrime + 2) / 5 + 1;
        var month = monthPrime + (monthPrime < 10 ? 3 : -9);
        return (year + (month <= 2 ? 1 : 0), (int)month, (int)day);
    }

    private static long FloorDiv(long dividend, long divisor)
    {
        var quotient = dividend / divisor;
        if (dividend % divisor != 0 && (dividend < 0) != (divisor < 0))
        {
            quotient--;
        }

        return quotient;
    }
}