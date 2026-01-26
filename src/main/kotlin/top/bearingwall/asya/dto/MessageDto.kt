package top.bearingwall.asya.dto

import io.swagger.v3.oas.annotations.media.Schema

@Schema(description = "消息类型")
enum class MessageType {
    NEWS, SECRET, BROADCAST
}
