package top.bearingwall.asya.dto

import io.swagger.v3.oas.annotations.media.Schema
import org.springframework.data.domain.Page
import top.bearingwall.asya.model.DelegateAttrType
import java.math.BigDecimal
import java.time.LocalDateTime

@Schema(description = "创建属性配置请求")
data class DelegateAttrConfigCreateRequest(
    @Schema(description = "属性key(英文)")
    val attrKey: String,

    @Schema(description = "属性展示名")
    val attrLabel: String,

    @Schema(description = "属性类型")
    val attrType: DelegateAttrType,

    @Schema(description = "排序值")
    val sortOrder: Int = 0,

    @Schema(description = "是否启用")
    val enabled: Boolean = true,

    @Schema(description = "是否可见（查询记录时仅返回可见列）")
    val visible: Boolean = true
)

@Schema(description = "更新属性配置请求")
data class DelegateAttrConfigUpdateRequest(
    @Schema(description = "属性展示名")
    val attrLabel: String? = null,

    @Schema(description = "属性类型")
    val attrType: DelegateAttrType? = null,

    @Schema(description = "排序值")
    val sortOrder: Int? = null,

    @Schema(description = "是否启用")
    val enabled: Boolean? = null,

    @Schema(description = "是否可见（查询记录时仅返回可见列）")
    val visible: Boolean? = null
)

@Schema(description = "属性配置响应")
data class DelegateAttrConfigResponse(
    val id: String,
    val attrKey: String,
    val attrLabel: String,
    val attrType: DelegateAttrType,
    val sortOrder: Int,
    val enabled: Boolean,
    val visible: Boolean
)

@Schema(description = "属性值写入项")
data class DelegateAttrValueInput(
    @Schema(description = "属性key")
    val attrKey: String,

    @Schema(description = "文本值（TEXT类型使用）")
    val textValue: String? = null,

    @Schema(description = "数值（NUMBER类型使用）")
    val numberValue: BigDecimal? = null
)

@Schema(description = "整条记录写入请求（全量覆盖）")
data class DelegateAttrRecordUpsertRequest(
    val values: List<DelegateAttrValueInput> = emptyList()
)

@Schema(description = "属性值过滤项")
data class DelegateAttrFilterItem(
    val attrKey: String,
    val textValue: String? = null,
    val numberValue: BigDecimal? = null
)

@Schema(description = "管理端查询请求")
data class DelegateAttrManageQueryRequest(
    val delegateIds: List<String>? = null,
    val attrFilters: List<DelegateAttrFilterItem>? = null
)

@Schema(description = "聚合属性值")
data class DelegateAttrTypedValueResponse(
    val attrType: DelegateAttrType,
    val textValue: String? = null,
    val numberValue: BigDecimal? = null
)

@Schema(description = "代表属性记录响应")
data class DelegateAttrRecordResponse(
    val recordId: String,
    val delegateId: String,
    val delegateName: String,
    val updatedAt: LocalDateTime,
    val values: Map<String, DelegateAttrTypedValueResponse?>
)

@Schema(description = "属性记录分页聚合响应")
data class DelegateAttrRecordPageResponse(
    val configs: List<DelegateAttrConfigResponse>,
    val records: Page<DelegateAttrRecordResponse>
)
