import {
  BooleanLiteral,
  Enum,
  getDeprecated,
  getDirectoryPath,
  getDoc,
  getFormat,
  getMaxItems,
  getMaxLength,
  getMaxValue,
  getMaxValueExclusive,
  getMinItems,
  getMinLength,
  getMinValue,
  getMinValueExclusive,
  getPattern,
  getRelativePathFromDirectory,
  getSummary,
  IntrinsicType,
  Model,
  ModelProperty,
  NumericLiteral,
  Program,
  Scalar,
  StringLiteral,
  Type,
  Union,
  UnionVariant,
} from "@typespec/compiler";
import {
  ArrayBuilder,
  Context,
  Declaration,
  EmitEntity,
  EmittedSourceFile,
  EmitterOutput,
  ObjectBuilder,
  Placeholder,
  Scope,
  SourceFile,
  SourceFileScope,
  TypeEmitter,
} from "@typespec/compiler/emitter-framework";
import yaml from "js-yaml";
import {
  findBaseUri,
  getContains,
  getContentEncoding,
  getContentMediaType,
  getContentSchema,
  getId,
  getMaxContains,
  getMaxProperties,
  getMinContains,
  getMinProperties,
  getMultipleOf,
  getPrefixItems,
  getUniqueItems,
  JsonSchemaDeclaration,
} from "./index.js";
import { JSONSchemaEmitterOptions } from "./lib.js";
export class JsonSchemaEmitter extends TypeEmitter<Record<string, any>, JSONSchemaEmitterOptions> {
  #seenIds = new Set();

  modelDeclaration(model: Model, name: string): EmitterOutput<object> {
    const schema = new ObjectBuilder({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: this.#getDeclId(model),
      type: "object",
      properties: this.emitter.emitModelProperties(model),
      required: this.#requiredModelProperties(model),
    });

    if (model.baseModel) {
      const allOf = new ArrayBuilder();
      allOf.push(this.emitter.emitTypeReference(model.baseModel));
      schema.set("allOf", allOf);
    }

    this.#applyConstraints(model, schema);

    return this.emitter.result.declaration(name, schema);
  }

  modelLiteral(model: Model): EmitterOutput<object> {
    const schema = new ObjectBuilder({
      type: "object",
      properties: this.emitter.emitModelProperties(model),
      required: this.#requiredModelProperties(model),
    });

    return schema;
  }

  modelInstantiation(model: Model, name: string): EmitterOutput<Record<string, any>> {
    return this.modelDeclaration(model, name);
  }

  arrayDeclaration(array: Model, name: string, elementType: Type): EmitterOutput<object> {
    const schema = new ObjectBuilder({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: this.#getDeclId(array),
      type: "array",
      items: this.emitter.emitTypeReference(elementType),
    });

    this.#applyConstraints(array, schema);

    return this.emitter.result.declaration(name, schema);
  }

  arrayLiteral(array: Model, elementType: Type): EmitterOutput<object> {
    return new ObjectBuilder({
      type: "array",
      items: this.emitter.emitTypeReference(elementType),
    });
  }

  #requiredModelProperties(model: Model): string[] | undefined {
    const requiredProps = [];

    for (const prop of model.properties.values()) {
      if (!prop.optional) {
        requiredProps.push(prop.name);
      }
    }

    return requiredProps.length > 0 ? requiredProps : undefined;
  }

  modelProperties(model: Model): EmitterOutput<object> {
    const props = new ObjectBuilder();

    for (const [name, prop] of model.properties) {
      const result = this.emitter.emitModelProperty(prop);
      props.set(name, result);
    }

    return props;
  }

  modelPropertyLiteral(property: ModelProperty): EmitterOutput<object> {
    const result = this.emitter.emitTypeReference(property.type);

    if (result.kind !== "code") {
      throw new Error("Unexpected non-code result from emit reference");
    }

    const withConstraints = new ObjectBuilder(result.value);
    this.#applyConstraints(property, withConstraints);

    return withConstraints;
  }

  booleanLiteral(boolean: BooleanLiteral): EmitterOutput<object> {
    return { type: "boolean", const: boolean.value };
  }

  stringLiteral(string: StringLiteral): EmitterOutput<object> {
    return { type: "string", const: string.value };
  }

  numericLiteral(number: NumericLiteral): EmitterOutput<object> {
    return { type: "number", const: number.value };
  }

  enumDeclaration(en: Enum, name: string): EmitterOutput<object> {
    const enumTypes = new Set<string>();
    const enumValues = new Set<string | number>();
    for (const member of en.members.values()) {
      // ???: why do we let emitters decide what the default type of an enum is
      enumTypes.add(member.value ? typeof member.value : "string");
      enumValues.add(member.value ?? member.name);
    }

    const enumTypesArray = [...enumTypes];

    return this.emitter.result.declaration(
      name,
      new ObjectBuilder({
        $schema: "https://json-schema.org/draft/2020-12/schema",
        $id: this.#getDeclId(en),
        type: enumTypesArray.length === 1 ? enumTypesArray[0] : enumTypesArray,
        enum: [...enumValues],
      })
    );
  }

  unionDeclaration(union: Union, name: string): EmitterOutput<object> {
    return this.emitter.result.declaration(
      name,
      new ObjectBuilder({
        $schema: "https://json-schema.org/draft/2020-12/schema",
        $id: this.#getDeclId(union),
        anyOf: this.emitter.emitUnionVariants(union),
      })
    );
  }

  unionLiteral(union: Union): EmitterOutput<object> {
    this.emitter.getProgram().resolveTypeReference("Cadl.Foo");
    return new ObjectBuilder({
      anyOf: this.emitter.emitUnionVariants(union),
    });
  }

  unionVariants(union: Union): EmitterOutput<object> {
    const variants = new ArrayBuilder();
    for (const variant of union.variants.values()) {
      variants.push(this.emitter.emitType(variant));
    }
    return variants;
  }

  unionVariant(variant: UnionVariant): EmitterOutput<object> {
    return this.emitter.emitTypeReference(variant.type);
  }

  modelPropertyReference(property: ModelProperty): EmitterOutput<object> {
    // this is interesting - model property references will generally need to inherit
    // the relevant decorators from the property they are referencing. I wonder if this
    // could be made easier, as it's a bit subtle.

    const refSchema = this.emitter.emitTypeReference(property.type);
    if (refSchema.kind !== "code") {
      throw new Error("Unexpected non-code result from emit reference");
    }
    const schema = new ObjectBuilder(refSchema.value);
    this.#applyConstraints(property, schema);
    return schema;
  }

  reference(
    targetDeclaration: Declaration<Record<string, unknown>>,
    pathUp: Scope<Record<string, unknown>>[],
    pathDown: Scope<Record<string, unknown>>[],
    commonScope: Scope<Record<string, unknown>> | null
  ): object | EmitEntity<Record<string, unknown>> {
    if (targetDeclaration.value instanceof Placeholder) {
      // I don't think this is possible, confirm.
      throw new Error("Can't form reference to declaration that hasn't been created yet");
    }

    if (targetDeclaration.value.$id) {
      return { $ref: targetDeclaration.value.$id };
    }

    if (!commonScope) {
      const currentSfScope = pathUp[pathUp.length - 1] as SourceFileScope<object>;
      const targetSfScope = pathDown[0] as SourceFileScope<object>;
      const resolved = getRelativePathFromDirectory(
        getDirectoryPath(currentSfScope.sourceFile.path),
        targetSfScope.sourceFile.path,
        false
      );
      return { $ref: resolved };
    }

    throw new Error("$ref to $defs not yet supported.");
  }

  scalarDeclaration(scalar: Scalar, name: string): EmitterOutput<object> {
    const baseBuiltIn = this.#scalarBuiltinBaseType(scalar);

    if (baseBuiltIn === null) {
      throw new Error(`Can't emit custom scalar type ${scalar.name}`);
    }

    let schema: Record<string, any>;
    switch (baseBuiltIn.name) {
      case "uint8":
        schema = { type: "integer", minimum: 0, maximum: 255 };
        break;
      case "uint16":
        schema = { type: "integer", minimum: 0, maximum: 65535 };
        break;
      case "uint32":
        schema = { type: "integer", minimum: 0, maximum: 4294967295 };
        break;
      case "int8":
        schema = { type: "integer", minimum: -128, maximum: 127 };
        break;
      case "int16":
        schema = { type: "integer", minimum: -32768, maximum: 32767 };
        break;
      case "int32":
        schema = { type: "integer", minimum: -2147483648, maximum: 2147483647 };
        break;
      case "int64":
        const int64Strategy = this.emitter.getOptions()["int64-strategy"] ?? "string";
        if (int64Strategy === "string") {
          schema = { type: "string" };
        } else {
          // can't use minimum and maximum because we can't actually encode these values as literals
          // without losing precision.
          schema = { type: "integer" };
        }
        break;
      case "uint64":
        const uint64Strategy = this.emitter.getOptions()["int64-strategy"] ?? "string";
        if (uint64Strategy === "string") {
          schema = { type: "string" };
        } else {
          // can't use minimum and maximum because we can't actually encode these values as literals
          // without losing precision.
          schema = { type: "integer" };
        }
        break;
      case "integer":
        schema = { type: "integer" };
        break;
      case "safeint":
        schema = { type: "integer" };
        break;
      case "float":
        schema = { type: "number" };
        break;
      case "float32":
        schema = { type: "number" };
        break;
      case "float64":
        schema = { type: "number" };
        break;
      case "numeric":
        schema = { type: "number" };
        break;
      case "string":
        schema = { type: "string" };
        break;
      case "boolean":
        schema = { type: "boolean" };
        break;
      case "plainDate":
        schema = { type: "string", format: "date" };
        break;
      case "plainTime":
        schema = { type: "string", format: "time" };
        break;
      case "offsetDateTime":
      case "utcDateTime":
        schema = { type: "string", format: "date-time" };
        break;
      case "duration":
        schema = { type: "string", format: "duration" };
        break;
      case "url":
        schema = { type: "string", format: "uri" };
        break;
      case "bytes":
        schema = { type: "string", contentEncoding: "base64" };
        break;
      default:
        throw new Error("Unknown scalar type " + baseBuiltIn.name);
    }

    const builderSchema = new ObjectBuilder(schema);

    // avoid creating declarations for built-in TypeSpec types
    if (baseBuiltIn === scalar) {
      return builderSchema;
    }

    builderSchema.$schema = "https://json-schema.org/draft/2020-12/schema";
    builderSchema.$id = this.#getDeclId(scalar);
    this.#applyConstraints(scalar, builderSchema);
    return this.emitter.result.declaration(name, builderSchema);
  }

  #applyConstraints(type: Scalar | Model | ModelProperty, schema: ObjectBuilder<unknown>) {
    const applyConstraint = (fn: (p: Program, t: Type) => any, key: string) => {
      const value = fn(this.emitter.getProgram(), type);
      if (value !== undefined) {
        schema[key] = value;
      }
    };

    const applyTypeConstraint = (fn: (p: Program, t: Type) => Type, key: string) => {
      const constraintType = fn(this.emitter.getProgram(), type);
      if (constraintType) {
        const ref = this.emitter.emitTypeReference(constraintType);
        if (ref.kind !== "code") {
          throw new Error("Couldn't get reference to contains type");
        }
        schema.set(key, ref.value);
      }
    };

    applyConstraint(getMinLength, "minLength");
    applyConstraint(getMaxLength, "maxLength");
    applyConstraint(getMinValue, "minimum");
    applyConstraint(getMinValueExclusive, "exclusiveMinimum");
    applyConstraint(getMaxValue, "maximum");
    applyConstraint(getMaxValueExclusive, "exclusiveMinimum");
    applyConstraint(getPattern, "pattern");
    applyConstraint(getMinItems, "minItems");
    applyConstraint(getMaxItems, "maxItems");

    // the stdlib applies a format of "url" but json schema wants "uri",
    // so ignore this format if it's the built-in type.
    if (!this.#isStdType(type) || type.name !== "url") {
      applyConstraint(getFormat, "format");
    }

    applyConstraint(getMultipleOf, "multipleOf");
    applyTypeConstraint(getContains, "contains");
    applyConstraint(getMinContains, "minContains");
    applyConstraint(getMaxContains, "maxContains");
    applyConstraint(getUniqueItems, "uniqueItems");
    applyConstraint(getMinProperties, "minProperties");
    applyConstraint(getMaxProperties, "maxProperties");
    applyConstraint(getContentEncoding, "contentEncoding");
    applyConstraint(getContentMediaType, "contentMediaType");
    applyTypeConstraint(getContentSchema, "contentSchema");
    applyConstraint(getDoc, "description");
    applyConstraint(getSummary, "title");
    applyConstraint(
      (p: Program, t: Type) => (getDeprecated(p, t) !== undefined ? true : undefined),
      "deprecated"
    );

    const prefixItems = getPrefixItems(this.emitter.getProgram(), type);
    if (prefixItems) {
      const prefixItemsSchema = new ArrayBuilder<Record<string, unknown>>();
      for (const item of prefixItems.values) {
        prefixItemsSchema.push(this.emitter.emitTypeReference(item));
      }
      schema.set("prefixItems", prefixItemsSchema);
    }
  }

  #scalarBuiltinBaseType(scalar: Scalar): Scalar | null {
    let current = scalar;
    while (current.baseScalar && !this.#isStdType(current)) {
      current = current.baseScalar;
    }

    if (this.#isStdType(current)) {
      return current;
    }

    return null;
  }

  #isStdType(type: Type) {
    return this.emitter.getProgram().checker.isStdType(type);
  }

  intrinsic(intrinsic: IntrinsicType, name: string): EmitterOutput<object> {
    switch (name) {
      case "null":
        return { type: "null" };
      case "unknown":
        return {};
    }

    throw new Error("Unknown intrinsic type " + name);
  }

  sourceFile(sourceFile: SourceFile<object>): EmittedSourceFile {
    let serializedContent: string;
    const decls = sourceFile.globalScope.declarations;

    let content: object;
    if (this.emitter.getOptions().bundleId) {
      const base = this.emitter.getOptions().emitterOutputDir;
      const file = sourceFile.path;
      const id = getRelativePathFromDirectory(base, file, false);
      content = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        $id: id,
        $defs: decls.reduce((prev, decl) => {
          prev[decl.name] = decl.value;
          return prev;
        }, {} as Record<string, any>),
      };
    } else {
      if (decls.length > 1) {
        throw new Error("Emit error - multiple decls in single schema per file mode");
      }

      content = decls[0].value;
    }

    if (this.emitter.getOptions()["file-type"] === "json") {
      serializedContent = JSON.stringify(content, null, 4);
    } else {
      serializedContent = yaml.dump(content);
    }

    return {
      contents: serializedContent,
      path: sourceFile.path,
    };
  }

  #getCurrentSourceFile() {
    let scope: Scope<object> = this.emitter.getContext().scope;
    if (!scope) throw new Error("need scope");

    while (scope && scope.kind !== "sourceFile") {
      scope = scope.parentScope;
    }

    if (!scope) throw new Error("Didn't find source file scope");

    return scope.sourceFile;
  }

  #getDeclId(type: JsonSchemaDeclaration): string {
    const baseUri = findBaseUri(this.emitter.getProgram(), type);
    const explicitId = getId(this.emitter.getProgram(), type);
    if (explicitId) {
      return this.#checkForDuplicateId(idWithBaseURI(explicitId, baseUri));
    }

    // generate an id
    if (this.emitter.getOptions().bundleId) {
      if (!type.name) {
        throw new Error("Type needs a name to emit a declaration id");
      }
      return this.#checkForDuplicateId(idWithBaseURI(this.declarationName(type), baseUri));
    } else {
      // generate the ID based on the file path
      const base = this.emitter.getOptions().emitterOutputDir;
      const file = this.#getCurrentSourceFile().path;
      const relative = getRelativePathFromDirectory(base, file, false);

      if (baseUri) {
        return this.#checkForDuplicateId(new URL(relative, baseUri).href);
      } else {
        return this.#checkForDuplicateId(relative);
      }
    }

    function idWithBaseURI(id: string, baseUri: string | undefined): string {
      if (baseUri) {
        return new URL(id, baseUri).href;
      } else {
        return id;
      }
    }
  }

  #checkForDuplicateId(id: string) {
    if (this.#seenIds.has(id)) {
      throw new Error(`Duplicate id: ${id}`);
    }

    this.#seenIds.add(id);
    return id;
  }

  // #region context emitters
  programContext(program: Program): Context {
    if (this.emitter.getOptions().bundleId) {
      const sourceFile = this.emitter.createSourceFile(this.emitter.getOptions().bundleId!);
      return { scope: sourceFile.globalScope };
    } else {
      return {};
    }
  }
  modelDeclarationContext(model: Model, name: string): Context {
    if (this.emitter.getOptions().bundleId) {
      return {};
    } else {
      if (this.#isStdType(model) && model.name === "object") {
        return {};
      }

      return this.#newFileScope(model.name);
    }
  }

  modelInstantiationContext(model: Model): Context {
    if (this.emitter.getOptions().bundleId) {
      return {};
    } else {
      return this.#newFileScope(this.declarationName(model));
    }
  }

  arrayDeclarationContext(array: Model): Context {
    if (this.emitter.getOptions().bundleId) {
      return {};
    } else {
      return this.#newFileScope(array.name);
    }
  }

  enumDeclarationContext(en: Enum): Context {
    if (this.emitter.getOptions().bundleId) {
      return {};
    } else {
      return this.#newFileScope(en.name);
    }
  }

  unionDeclarationContext(union: Union): Context {
    if (this.emitter.getOptions().bundleId) {
      return {};
    } else {
      return this.#newFileScope(union.name!);
    }
  }

  scalarDeclarationContext(scalar: Scalar): Context {
    if (this.emitter.getOptions().bundleId) {
      return {};
    } else if (this.#isStdType(scalar)) {
      return {};
    } else {
      return this.#newFileScope(scalar.name);
    }
  }

  #newFileScope(name: string) {
    const sourceFile = this.emitter.createSourceFile(`${name}.${this.#fileExtension()}`);
    return {
      scope: sourceFile.globalScope,
    };
  }

  #fileExtension() {
    return this.emitter.getOptions()["file-type"] === "json" ? "json" : "yaml";
  }

  // #endregion
}
