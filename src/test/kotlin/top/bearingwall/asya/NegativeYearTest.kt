package top.bearingwall.asya

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule
import com.fasterxml.jackson.module.kotlin.jacksonObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.time.LocalDateTime

class NegativeYearTest {

    data class DateTimeDto(
        val time: LocalDateTime
    )

    @Test
    fun `test negative year serialization`() {
        val mapper = jacksonObjectMapper()
        mapper.registerModule(JavaTimeModule())

        // Create a date with negative year: -450
        // Note: Year -450 is 451 BC.
        // LocalDateTime.of(year, month, day, hour, minute)
        val date = LocalDateTime.of(-450, 1, 1, 12, 0)

        val json = mapper.writeValueAsString(DateTimeDto(date))
        println("Serialized: $json")

        // Check if output contains -0450
        // Expected: "time":[-450,1,1,12,0] by default if write_dates_as_timestamps is enabled/default?
        // Actually java 8 date/time serialization often defaults to array if not configured otherwise.
    }

    @Test
    fun `test negative year deserialization`() {
        val mapper = jacksonObjectMapper()
        mapper.registerModule(JavaTimeModule())

        val json = """{"time":"-0450-01-01T12:00:00"}"""
        val dto = mapper.readValue(json, DateTimeDto::class.java)

        assertEquals(-450, dto.time.year)
    }
}
