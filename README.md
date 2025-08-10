# `gql-typed` - Strongly typed GraphQL

> WORK IN PROGRESS: Not tested heavily yet, Type-level validation is not yet implemented.

## Motivation

When building GraphQL APIs in TypeScript, it’s easy to end up with **runtime-only type safety**—your TypeScript code might compile just fine, but at runtime your schema can still contain:

* Fields that don’t match the actual TypeScript types.
* Missing or mismatched resolvers.
* Incorrect arguments, nullability, or return types.
* Schema definitions that drift from your resolvers over time.

Existing GraphQL libraries (like `type-graphql`, `nexus`) improve the developer experience, but they usually rely on **runtime validation** or **code generation** to get some type safety. This often means:

* You only notice mismatches when you run the app or tests.
* You may need an extra build step for generating types from SDL.
* You can accidentally deploy an invalid schema without knowing.

`gql-typed` solves this by **pushing schema validation into the TypeScript type system itself**:

* **Type errors at compile time** if your schema is invalid.
* No separate code generation step.
* The schema itself is a **typed object**, ensuring resolvers match field definitions.
* Works incrementally across multiple files, without having to declare everything in one place.
* Produces plain `graphql` types at runtime, so you can integrate with any existing GraphQL server.

In short: **If your TypeScript compiles, your GraphQL schema is valid**.

## Usage Example

```ts
// Config.ts
export interface Config { // global config for your schema
  context: Context;
  // ... and with optional configurations, like scalarMap, etc.
}

// User.ts
export interface User {
  id: string;
  name: string;
  email: string;
}

// GraphQLUser.ts
export const GraphQLUser = objectType<Config, User>()({
  name: "User",
  fields: {
    id: { type: { type: "ID" } },
    name: {
      description: "login name", // optional description
      type: { type: "String" },
    },
  },
  fieldResolvers: {
    email: resolver<string | undefined>()()({ // say email is authorized field
      type: { nullable: true, type: "String" },
      resolve(user, _args, context, _info) { // this will be passed to graphql
        return context.diContainer.resolve(UserService).getUserEmail(user);
      },
    }),
    postsConnection, // field resolvers can be defined across multiple files
  },
});

// fieldResolvers/Query/userById.ts
export const userById = resolver<User | null, Record<"id", string>>()<
  Config, // in across multiple files, additional generic arguments are required
  {} // type of the parent(`Query`) object (`{}` in this example)
>()({
  type: { nullable: true, type: "User" },
  args: {
    id: { description: "user id", type: { type: "ID" } },
  },
  resolve(_parent, args, context, _info) {
    return context.diContainer.resolve(UserService).getUserById(args.id);
  },
  deprecationReason: "use user instead",
});

// GraphQLQuery.ts
export const GraphQLQuery = objectType<Config, undefined>()({
  name: "Query",
  fieldResolvers: { userById, ...andOtherFieldsInQuery },
});

// schema.ts
export const schema = create<Config>()
  .register(GraphQLQuery, GraphQLUser, ...otherTypes)
  .build({
    Query: {}, // as `{}` is used to represent `Query` object type
    Mutation: {},
  }).schema; // you can chain .register(), or print the schema to a file as well
// type of `schema` will be error message if your schema has validation errors
(<T>(_: Exclude<T, string>) => {})<typeof schema>(schema); // type error if so
```

## Why `fn()()(input)`?

In TypeScript, you can’t partially infer and partially provide generics in a single call in a clean way. The currying-like syntax:

```ts
objectType<Config, User>()({ ... })
```

allows you to:

* Pass some generics explicitly.
* Let the rest be inferred from the input object.
* Avoid declaring the object separately with `as const` just to get proper inference.

Without this, you’d need to do:

```ts
const def = { ... } as const;
objectType<Config, User, typeof def>(def);
```

which is verbose and less ergonomic.

If you’re a pure JavaScript user, you can just use the `graphql` package directly—`gql-typed` is essentially a type-safe wrapper with compile-time validation.

## Features

* **Full compile-time schema validation** — no runtime mismatch surprises.
* **Type-safe resolvers** — resolver args, parent, and return type are all checked.
* **Multi-file schema definition** — works even if field resolvers are split across files.
* **Integrates with existing GraphQL servers** — returns standard `graphql` package objects.
* **No code generation** — no extra build step required.
* **Clear, early feedback** — if your schema is invalid, TypeScript tells you before running the app.
