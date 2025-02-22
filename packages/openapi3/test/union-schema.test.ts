import { deepStrictEqual, ok } from "assert";
import { oapiForModel, openApiFor } from "./test-host.js";

describe("openapi3: union type", () => {
  it("makes nullable schema when union with null", async () => {
    const res = await openApiFor(
      `
      model Thing {
        id: string;
        properties: Thing | null;
      }
      op doStuff(): Thing;
      `
    );
    deepStrictEqual(res.components.schemas.Thing.properties.properties, {
      type: "object",
      allOf: [{ $ref: "#/components/schemas/Thing" }],
      nullable: true,
      "x-typespec-name": "Thing | null",
    });
  });

  it("handles discriminated unions", async () => {
    const res = await openApiFor(
      `
      model A {
        type: "ay";
        a: string;
      }

      model B {
        type: "bee";
        b: string;
      }

      @discriminator("type")
      union AorB {
        a: A,
        b: B
      }

      op foo(x: AorB): { thing: AorB };
      `
    );

    deepStrictEqual(res.components.schemas.AorB, {
      anyOf: [
        {
          $ref: "#/components/schemas/A",
        },
        {
          $ref: "#/components/schemas/B",
        },
      ],
      discriminator: {
        propertyName: "type",
        mapping: {
          ay: "#/components/schemas/A",
          bee: "#/components/schemas/B",
        },
      },
    });
  });

  it("handles discriminated unions with enum typed fields", async () => {
    const res = await openApiFor(
      `
      enum Types {
        A;
        B: "bee";
      }
      model A {
        type: Types.A;
        a: string;
      }

      model B {
        type: Types.B;
        b: string;
      }

      @discriminator("type")
      union AorB {
        a: A,
        b: B
      }

      op foo(x: AorB): { thing: AorB };
      `
    );

    deepStrictEqual(res.components.schemas.AorB, {
      anyOf: [
        {
          $ref: "#/components/schemas/A",
        },
        {
          $ref: "#/components/schemas/B",
        },
      ],
      discriminator: {
        propertyName: "type",
        mapping: {
          A: "#/components/schemas/A",
          bee: "#/components/schemas/B",
        },
      },
    });
  });

  it("defines nullable properties with multiple variants", async () => {
    const res = await oapiForModel(
      "Pet",
      `
      model Pet {
        name: int32 | string | null;
      };
      `
    );
    ok(res.isRef);
    ok(res.schemas.Pet.properties.name.nullable);
    deepStrictEqual(res.schemas.Pet.properties.name.anyOf, [
      {
        type: "integer",
        format: "int32",
      },
      {
        type: "string",
      },
    ]);
  });

  it("defines enums with a nullable variant", async () => {
    const res = await oapiForModel(
      "Pet",
      `
      model Pet {
        type: "cat" | "dog" | null;
      };
    `
    );
    ok(res.isRef);
    deepStrictEqual(res.schemas.Pet, {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["cat", "dog"],
          nullable: true,
          "x-typespec-name": "cat | dog | null",
        },
      },
      required: ["type"],
    });
  });

  it("handles unions of heterogenous types", async () => {
    const res = await oapiForModel(
      "X",
      `
      model C {}
      model X {
        prop: 1 | C;
        prop2: C | 1; 
      }
      `
    );
    ok(res.isRef);
    deepStrictEqual(res.schemas.X.properties.prop.anyOf, [
      {
        type: "number",
        enum: [1],
      },
      {
        $ref: "#/components/schemas/C",
      },
    ]);
    deepStrictEqual(res.schemas.X.properties.prop2.anyOf, [
      {
        $ref: "#/components/schemas/C",
      },
      {
        type: "number",
        enum: [1],
      },
    ]);
  });

  it("handles unions of different primitive types", async () => {
    const res = await oapiForModel(
      "X",
      `
      model X {
        prop: 1 | "string"
      }
      `
    );
    ok(res.isRef);
    deepStrictEqual(res.schemas.X.properties.prop.anyOf, [
      {
        type: "number",
        enum: [1],
      },
      {
        type: "string",
        enum: ["string"],
      },
    ]);
  });

  it("handles enum unions", async () => {
    const res = await oapiForModel(
      "X",
      `
      enum A {
        a: 1
      }
      
      enum B {
        b: 2
      }
      model X {
        prop: A | B
      }
      `
    );
    ok(res.isRef);
    deepStrictEqual(res.schemas.X.properties.prop.anyOf, [
      {
        $ref: "#/components/schemas/A",
      },
      {
        $ref: "#/components/schemas/B",
      },
    ]);
  });

  it("handles a nullable enum", async () => {
    const res = await oapiForModel(
      "X",
      `
      enum A {
        a: 1
      }
      
      model X {
        prop: A | null
      }
      `
    );
    ok(res.isRef);
    deepStrictEqual(res.schemas.X.properties.prop.oneOf, [
      {
        $ref: "#/components/schemas/A",
      },
    ]);
    ok(res.schemas.X.properties.prop.nullable);
  });
});
