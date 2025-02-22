---
title: "Decorators"
toc_min_heading_level: 2
toc_max_heading_level: 3
---

# Decorators

## OpenAPI

### `@defaultResponse` {#@OpenAPI.defaultResponse}

Specify that this model is to be treated as the OpenAPI `default` response.
This differs from the compiler built-in `@error` decorator as this does not necessarily represent an error.

```typespec
@OpenAPI.defaultResponse
```

#### Target

`Model`

#### Parameters

None

#### Examples

```typespec
@defaultResponse
model PetStoreResponse is object;

op listPets(): Pet[] | PetStoreResponse;
```

### `@extension` {#@OpenAPI.extension}

Attach some custom data to the OpenAPI element generated from this type.

```typespec
@OpenAPI.extension(key: valueof string, value: unknown)
```

#### Target

`(intrinsic) unknown`

#### Parameters

| Name  | Type                    | Description                         |
| ----- | ----------------------- | ----------------------------------- |
| key   | `valueof scalar string` | Extension key. Must start with `x-` |
| value | `(intrinsic) unknown`   | Extension value.                    |

#### Examples

```typespec
@extension("x-custom", "My value")
@extension("x-pageable", {nextLink: "x-next-link"})
op read(): string;
```

### `@externalDocs` {#@OpenAPI.externalDocs}

Specify the OpenAPI `externalDocs` property for this type.

```typespec
@OpenAPI.externalDocs(url: valueof string, description?: valueof string)
```

#### Target

`(intrinsic) unknown`

#### Parameters

| Name        | Type                    | Description             |
| ----------- | ----------------------- | ----------------------- |
| url         | `valueof scalar string` | Url to the docs         |
| description | `valueof scalar string` | Description of the docs |

#### Examples

```typespec
@externalDocs("https://example.com/detailed.md", "Detailed information on how to use this operation")
op listPets(): Pet[];
```

### `@operationId` {#@OpenAPI.operationId}

Specify the OpenAPI `operationId` property for this operation.

```typespec
@OpenAPI.operationId(operationId: valueof string)
```

#### Target

`Operation`

#### Parameters

| Name        | Type                    | Description         |
| ----------- | ----------------------- | ------------------- |
| operationId | `valueof scalar string` | Operation id value. |

#### Examples

```typespec
@operationId("download")
op read(): string;
```
