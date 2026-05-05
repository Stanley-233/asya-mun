package top.bearingwall.asya.util

import jakarta.persistence.AttributeConverter
import jakarta.persistence.Converter
import java.time.LocalDateTime

@Converter
class LocalDateTimeStringConverter : AttributeConverter<LocalDateTime, String> {
    override fun convertToDatabaseColumn(attribute: LocalDateTime?): String? {
        // LocalDateTime.toString() produces standard ISO-8601 format (e.g., "-0420-01-26T04:58:12.976")
        return attribute?.toString()
    }

    override fun convertToEntityAttribute(dbData: String?): LocalDateTime? {
        // LocalDateTime.parse() uses ISO_LOCAL_DATE_TIME formatter by default
        return dbData?.let { LocalDateTime.parse(it) }
    }
}
