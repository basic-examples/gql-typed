import { create, enumType, objectType, resolver } from "gql-typed";
import { printSchema } from "graphql";

// Config.ts
export interface MyConfig {
  // global config for your schema
  context: any;
  // ... and with optional configurations, like scalarMap, etc.
}

// User.ts
export interface User {
  id: string;
  name: string;
  email: string;
}

// GraphQLUser.ts
export const GraphQLUser = objectType<MyConfig, User>()({
  name: "User",
  fields: {
    id: { type: { type: "ID" } },
    name: {
      description: "login name", // optional description
      type: { type: "String" },
    },
  },
  fieldResolvers: {
    email: resolver<string | undefined>()<MyConfig, User>()({
      // say email is authorized field
      type: { nullable: true, type: "String" },
      resolve(user, _args, context, _info) {
        // this will be passed to graphql
        return context.diContainer.UserService.getUserEmail(user);
      },
    }),
  },
});

// fieldResolvers/Query/userById.ts
export const userById = resolver<User | null, Record<"id", string>>()<
  MyConfig, // in across multiple files, additional generic arguments are required
  {} // type of the parent(`Query`) object (`{}` in this example)
>()({
  type: { nullable: true, type: "User" },
  args: {
    id: { description: "user id", type: { type: "ID" } },
  },
  resolve(_ /* parent (`{}` here) */, args, context, _info) {
    return context.diContainer.UserService.getUserById(args.id);
  },
  deprecationReason: "use user instead",
});

// GraphQLQuery.ts
export const GraphQLQuery = objectType<MyConfig, {}>()({
  name: "Query",
  fieldResolvers: { userById },
});

// schema.ts
const Mutation = objectType<MyConfig, {}>()({ name: "Mutation" });
const MyEnum = enumType<"a" | "b">()({
  name: "MyEnum",
  values: {
    a: {},
    b: {},
  },
  description: "tset enum",
});
const builder = create<MyConfig>()
  .register(GraphQLQuery, GraphQLUser, Mutation)
  .register(MyEnum);
export const schema = builder.build({
  Query: {}, // as `{}` is used to represent `Query` object type
  Mutation: {},
}).schema; // you can chain .register(), or print the schema to a file as well
// type of `schema` will be error message if your schema has validation errors
(<T>(_: Exclude<T, string>) => {})<typeof schema>(schema); // type error if so

console.log(printSchema(schema));
