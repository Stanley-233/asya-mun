package top.bearingwall.asya.controller

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController
import top.bearingwall.asya.dto.Result

@RestController
class HelloWorldController {

    @GetMapping("/hello")
    fun helloWorld(): Result<String> {
        return Result.success("Hello World")
    }
}