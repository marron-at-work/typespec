import { strictEqual } from "assert";
import { Model, Scalar } from "../../core/types.js";
import { TestHost, createTestHost } from "../../testing/index.js";

describe("compiler: validate", () => {
  let testHost: TestHost;

  beforeEach(async () => {
    testHost = await createTestHost();
  });

  it("basic validate", async () => {
    testHost.addTypeSpecFile(
      "main.tsp",
      `  
      @test model M {
        ii: int64;

        validate chkii: ii >= 0;
      }
      `
    );

    const { M } = (await testHost.compile("main.tsp")) as {
      M: Model;
    };

    strictEqual(M.validates.size, 1);
  });

  it("validate x2", async () => {
    testHost.addTypeSpecFile(
      "main.tsp",
      `  
      @test model M {
        ii: int64;

        validate chkiil: ii >= 0;
        validate chkiih: ii < 100;
      }
      `
    );

    const { M } = (await testHost.compile("main.tsp")) as {
      M: Model;
    };

    strictEqual(M.validates.size, 2);
  });

  it("basic validate with doc", async () => {
    testHost.addTypeSpecFile(
      "main.tsp",
      `  
      @test model M {
        ii: int64;

        @doc("Check that ii is greater than or equal to 0")
        validate chkii: ii >= 0;
      }
      `
    );

    const { M } = (await testHost.compile("main.tsp")) as {
      M: Model;
    };

    strictEqual(M.validates.size, 1);
    strictEqual(M.validates.get("chkii")?.decorators.length, 1);
    strictEqual(M.validates.get("chkii")?.decorators[0].decorator.name, "$doc");
    strictEqual(M.validates.get("chkii")?.decorators[0].args.length, 1);
    strictEqual(
      M.validates.get("chkii")?.decorators[0].args[0].jsValue,
      "Check that ii is greater than or equal to 0"
    );
  });
  it("basic scalar validate", async () => {
    testHost.addTypeSpecFile(
      "main.tsp",
      `  
      @test scalar S extends int64 {
        validate chkv: value >= 0;
      }
      `
    );

    const { S } = (await testHost.compile("main.tsp")) as {
      S: Scalar;
    };

    strictEqual(S.validates.size, 1);
  });
});
