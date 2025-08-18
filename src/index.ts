import {
  GraphQLArgumentConfig,
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFieldConfig,
  GraphQLFloat,
  GraphQLID,
  GraphQLInputFieldConfig,
  GraphQLInputObjectType,
  GraphQLInputType,
  GraphQLInt,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLResolveInfo,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLString,
  GraphQLType,
  GraphQLUnionType,
  ValueNode,
} from "graphql";

interface ConfigBase {
  scalarMap?: Partial<Record<string, unknown>>;
  context: unknown;
}

export type { ConfigBase as Config };

type UnionToIntersection<T> = (
  T extends any ? (arg: T) => unknown : never
) extends (arg: infer I) => unknown
  ? I
  : never;

type UnionAny<T> = ReturnType<
  Extract<UnionToIntersection<T extends any ? () => T : never>, () => unknown>
>;

type IsSameType<X, Y> = (<T>() => T extends X ? 0 : 1) extends <
  T
>() => T extends Y ? 0 : 1
  ? true
  : false;

export type TypeDescriptor<T> = (unknown extends T
  ? { nullable?: boolean }
  : Extract<T, null | undefined> extends never
  ? { nullable?: false }
  : { nullable: true }) & {
  type: NonNullable<T> extends readonly (infer I)[]
    ? TypeDescriptor<I>
    : string;
};

interface ResolverInput<
  Config extends ConfigBase,
  T,
  Result,
  Args extends Partial<Record<string, unknown>>
> {
  type: TypeDescriptor<Result>;
  description?: string;
  args?: { [K in keyof Args]: ResolverInputField<Args[K]> };
  resolve: (
    parent: T,
    args: Args,
    context: Config["context"],
    info: GraphQLResolveInfo
  ) => Result;
  deprecationReason?: string;
}

export interface ResolverInputField<T> {
  description?: string | null;
  type: TypeDescriptor<T>;
  defaultValue?: T;
  deprecationReason?: string | null;
}

export type AnyResolverInput<Config extends ConfigBase, T> = ResolverInput<
  Config,
  T,
  unknown,
  any // this is unavoidable because of variance inside the graphql package
>;

export interface ResolverOutput<
  Config extends ConfigBase,
  T,
  Result,
  Args extends Partial<Record<string, unknown>>,
  Input extends ResolverInput<Config, T, Result, Args>
> {
  internal: (
    incomplete: IncompleteSchema<Config, TypeMapBase<Config>>
  ) => GraphQLFieldConfig<T, Config["context"], Args>;
  " onlyOnTypes": ResolverOutputInternal<Config, T, Result, Args, Input>;
}

interface ResolverOutputInternal<
  Config extends ConfigBase,
  T,
  Result,
  Args extends Partial<Record<string, unknown>>,
  Input extends ResolverInput<Config, T, Result, Args>
> {
  config: Config;
  type: T;
  args: Args;
  result: Result;
  input: Input;
}

export type AnyResolverOutput<Config extends ConfigBase, T> = ResolverOutput<
  Config,
  T,
  unknown,
  any, // this is unavoidable because of variance inside the graphql package
  AnyResolverInput<Config, T>
>;

export function resolver<
  Result,
  Args extends Partial<Record<string, unknown>> = {}
>(): <Config extends ConfigBase, T>() => <
  const Input extends ResolverInput<Config, T, Result, Args>
>(
  input: Input
) => ResolverOutput<Config, T, Result, Args, Input> {
  return resolverInternal1;
}

function resolverInternal1<
  Config extends ConfigBase,
  T,
  Result,
  Args extends Partial<Record<string, unknown>>
>(): <const Input extends ResolverInput<Config, T, Result, Args>>(
  input: Input
) => ResolverOutput<Config, T, Result, Args, Input> {
  return resolverInternal2;
}

function resolverInternal2<
  Config extends ConfigBase,
  T,
  Result,
  Args extends Partial<Record<string, unknown>>,
  Input extends ResolverInput<Config, T, Result, Args>
>(input: Input): ResolverOutput<Config, T, Result, Args, Input> {
  const result: Omit<
    ResolverOutput<Config, T, Result, Args, Input>,
    " onlyOnTypes"
  > = {
    internal: (incomplete) => resolverImpl(incomplete, input),
  };
  return result as ResolverOutput<Config, T, Result, Args, Input>;
}

function resolverImpl<
  Config extends ConfigBase,
  T,
  Result,
  Args extends Partial<Record<string, unknown>>
>(
  incomplete: IncompleteSchema<Config, TypeMapBase<Config>>,
  input: ResolverInput<Config, T, Result, Args>
): GraphQLFieldConfig<T, Config["context"], Args> {
  return {
    type: incomplete.getType(input.type) as GraphQLOutputType,
    description: input.description,
    deprecationReason: input.deprecationReason,
    args: Object.fromEntries(
      Object.entries(input.args ?? {}).map(
        ([key, field]): [string, GraphQLArgumentConfig] => {
          const { type, description, defaultValue, deprecationReason } =
            field as ResolverInputField<unknown>;
          return [
            key,
            {
              type: incomplete.getType(type) as GraphQLInputType,
              description,
              defaultValue,
              deprecationReason,
            },
          ];
        }
      )
    ),
    resolve: input.resolve,
  };
}

export interface ObjectTypeInputField<T> {
  description?: string;
  type: TypeDescriptor<T>;
  deprecationReason?: string;
}

interface ObjectTypeInput<Config extends ConfigBase, T> {
  name: string;
  description?: string;
  implementsInterfaces?: string[];
  fields?: {
    [K in keyof T]?: ObjectTypeInputField<T[K]>;
  };
  fieldResolvers?: Partial<Record<string, AnyResolverOutput<Config, T>>>;
}

export interface ObjectTypeOutput<
  Config extends ConfigBase,
  T,
  Input extends ObjectTypeInput<Config, T>
> {
  kind: "object";
  name: Input["name"];
  internal: (
    incomplete: IncompleteSchema<Config, TypeMapBase<Config>>
  ) => GraphQLObjectType;
  " onlyOnTypes": ObjectTypeOutputInternal<Config, T, Input>;
}

interface ObjectTypeOutputInternal<
  Config extends ConfigBase,
  T,
  Input extends ObjectTypeInput<Config, T>
> {
  config: Config;
  type: T;
  input: Input;
}

export type AnyObjectTypeOutput<
  Config extends ConfigBase,
  T
> = ObjectTypeOutput<Config, T, ObjectTypeInput<Config, T>>;

export function objectType<Config extends ConfigBase, T>(): <
  const Input extends ObjectTypeInput<Config, T>
>(
  input: Input
) => ObjectTypeOutput<Config, T, Input> {
  return objectTypeInternal;
}

function objectTypeInternal<
  Config extends ConfigBase,
  T,
  Input extends ObjectTypeInput<Config, T>
>(input: Input): ObjectTypeOutput<Config, T, Input> {
  const result: Omit<ObjectTypeOutput<Config, T, Input>, " onlyOnTypes"> = {
    kind: "object",
    name: input.name,
    internal: (incomplete) =>
      objectTypeImpl<Config, T, Input>(incomplete, input),
  };
  return result as ObjectTypeOutput<Config, T, Input>;
}

function objectTypeImpl<
  Config extends ConfigBase,
  T,
  Input extends ObjectTypeInput<Config, T>
>(
  incomplete: IncompleteSchema<Config, TypeMapBase<Config>>,
  input: Input
): GraphQLObjectType {
  let lazilyResolvedInterfaces: GraphQLInterfaceType[] | undefined;
  let lazilyResolvedFields:
    | Record<string, GraphQLFieldConfig<T, Config["context"], unknown>>
    | undefined;
  return new GraphQLObjectType({
    name: input.name,
    description: input.description,
    interfaces: () =>
      (lazilyResolvedInterfaces ??= (input.implementsInterfaces ?? []).map(
        (name) =>
          incomplete.getType({
            nullable: true,
            type: name,
          }) as GraphQLInterfaceType
      )),
    fields: () =>
      (lazilyResolvedFields ??= {
        ...Object.fromEntries(
          Object.entries(input.fields ?? {}).map(
            ([key, field]): [
              string,
              GraphQLFieldConfig<T, Config["context"], unknown>
            ] => {
              const { type, description, deprecationReason } =
                field as ObjectTypeInputField<T[keyof T]>;
              return [
                key,
                {
                  type: incomplete.getType(type) as GraphQLOutputType,
                  description,
                  deprecationReason,
                },
              ];
            }
          )
        ),
        ...Object.fromEntries(
          Object.entries(input.fieldResolvers ?? {}).map(
            ([key, resolver]): [
              string,
              GraphQLFieldConfig<T, Config["context"], unknown>
            ] => {
              return [
                key,
                (resolver as AnyResolverOutput<Config, T>).internal(incomplete),
              ];
            }
          )
        ),
      }),
  });
}

interface InterfaceTypeInputField<T> {
  description?: string;
  type: TypeDescriptor<T>;
  deprecationReason?: string;
}

interface InterfaceTypeInput<T> {
  name: string;
  description?: string;
  implementsInterfaces?: string[];
  fields?: {
    [K in keyof T]?: InterfaceTypeInputField<T[K]>;
  };
}

export interface InterfaceTypeOutput<
  Config extends ConfigBase,
  T,
  Input extends InterfaceTypeInput<T>
> {
  kind: "interface";
  name: Input["name"];
  internal: (
    incomplete: IncompleteSchema<Config, TypeMapBase<Config>>
  ) => GraphQLInterfaceType;
  " onlyOnTypes": InterfaceTypeOutputInternal<T, Input>;
}

interface InterfaceTypeOutputInternal<T, Input extends InterfaceTypeInput<T>> {
  type: T;
  input: Input;
}

export type AnyInterfaceTypeOutput<
  Config extends ConfigBase,
  T
> = InterfaceTypeOutput<Config, T, InterfaceTypeInput<T>>;

export function interfaceType<Config extends ConfigBase, T>(): <
  const Input extends InterfaceTypeInput<T>
>(
  input: Input
) => InterfaceTypeOutput<Config, T, Input> {
  return interfaceTypeInternal;
}

function interfaceTypeInternal<
  Config extends ConfigBase,
  T,
  Input extends InterfaceTypeInput<T>
>(input: Input): InterfaceTypeOutput<Config, T, Input> {
  const result: Omit<InterfaceTypeOutput<Config, T, Input>, " onlyOnTypes"> = {
    kind: "interface",
    name: input.name,
    internal: (incomplete) => interfaceTypeImpl(incomplete, input),
  };
  return result as InterfaceTypeOutput<Config, T, Input>;
}

function interfaceTypeImpl<
  Config extends ConfigBase,
  T,
  Input extends InterfaceTypeInput<T>
>(
  incomplete: IncompleteSchema<Config, TypeMapBase<Config>>,
  input: Input
): GraphQLInterfaceType {
  let lazilyResolvedInterfaces: GraphQLInterfaceType[] | undefined;
  let lazilyResolvedFields:
    | Record<string, GraphQLFieldConfig<T, Config["context"], unknown>>
    | undefined;
  return new GraphQLInterfaceType({
    name: input.name,
    description: input.description,
    interfaces: () =>
      (lazilyResolvedInterfaces ??= (input.implementsInterfaces ?? []).map(
        (name) =>
          incomplete.getType({
            nullable: true,
            type: name,
          }) as GraphQLInterfaceType
      )),
    fields: () =>
      (lazilyResolvedFields ??= Object.fromEntries(
        Object.entries(input.fields ?? {}).map(
          ([key, field]): [
            string,
            GraphQLFieldConfig<T, Config["context"], unknown>
          ] => {
            const { type, description, deprecationReason } =
              field as InterfaceTypeInputField<T[keyof T]>;
            return [
              key,
              {
                type: incomplete.getType(type) as GraphQLOutputType,
                description,
                deprecationReason,
              },
            ];
          }
        )
      )),
  });
}

export interface ScalarTypeInput<T> {
  name: string;
  description?: string;
  specifiedByURL?: string;
  serialize?: (value: T) => unknown;
  parseValue?: (value: unknown) => T;
  parseLiteral?: (
    valueNode: ValueNode,
    variables?: Partial<Record<string, unknown>> | null
  ) => T;
}

export interface ScalarTypeOutput<T, Input extends ScalarTypeInput<T>> {
  kind: "scalar";
  name: Input["name"];
  internal: () => GraphQLScalarType<T, unknown>;
  " onlyOnTypes": ScalarTypeOutputInternal<T, Input>;
}

interface ScalarTypeOutputInternal<T, Input extends ScalarTypeInput<T>> {
  type: T;
  input: Input;
}

export type AnyScalarTypeOutput<T> = ScalarTypeOutput<T, ScalarTypeInput<T>>;

export function scalarType<T>(): <const Input extends ScalarTypeInput<T>>(
  input: Input
) => ScalarTypeOutput<T, Input>;
export function scalarType(): unknown {
  return scalarTypeInternal;
}

function scalarTypeInternal<T, Input extends ScalarTypeInput<T>>(
  input: Input
): ScalarTypeOutput<T, Input> {
  const result: Omit<ScalarTypeOutput<T, Input>, " onlyOnTypes"> = {
    kind: "scalar",
    name: input.name,
    internal: () =>
      new GraphQLScalarType(
        input as ScalarTypeInput<unknown> // because GraphQLScalarSerializer is not typed for internal type
      ) as GraphQLScalarType<T, unknown>,
  };
  return result as ScalarTypeOutput<T, Input>;
}

interface EnumTypeInput<T extends string> {
  name: string;
  description?: string;
  values: Record<T, EnumValue>;
}

export interface EnumValue {
  description?: string;
  deprecationReason?: string;
}

export interface EnumTypeOutput<
  T extends string,
  Input extends EnumTypeInput<T>
> {
  kind: "enum";
  name: Input["name"];
  internal: () => GraphQLEnumType;
  " onlyOnTypes": EnumTypeOutputInternal<T, Input>;
}

interface EnumTypeOutputInternal<
  T extends string,
  Input extends EnumTypeInput<T>
> {
  type: T;
  input: Input;
}

export type AnyEnumTypeOutput<T extends string> = EnumTypeOutput<
  T,
  EnumTypeInput<T>
>;

export function enumType<T extends string>(): <
  const Input extends EnumTypeInput<T>
>(
  input: Input
) => EnumTypeOutput<T, Input> {
  return enumTypeInternal;
}

function enumTypeInternal<T extends string, Input extends EnumTypeInput<T>>(
  input: Input
): EnumTypeOutput<T, Input> {
  const result: Omit<EnumTypeOutput<T, Input>, " onlyOnTypes"> = {
    kind: "enum",
    name: input.name,
    internal: () => new GraphQLEnumType(input),
  };
  return result as EnumTypeOutput<T, Input>;
}

export interface InputTypeInputField<T> {
  description?: string;
  type: TypeDescriptor<T>;
  deprecationReason?: string;
  defaultValue?: T;
}

interface InputTypeInput<T> {
  name: string;
  description?: string;
  fields: {
    [K in keyof T]: InputTypeInputField<T[K]>;
  };
}

export interface InputTypeOutput<
  Config extends ConfigBase,
  T,
  Input extends InputTypeInput<T>
> {
  kind: "input";
  name: Input["name"];
  internal: (
    incomplete: IncompleteSchema<Config, TypeMapBase<Config>>
  ) => GraphQLInputObjectType;
  " onlyOnTypes": InputTypeOutputInternal<T, Input>;
}

interface InputTypeOutputInternal<T, Input extends InputTypeInput<T>> {
  type: T;
  input: Input;
}

export type AnyInputTypeOutput<Config extends ConfigBase, T> = InputTypeOutput<
  Config,
  T,
  InputTypeInput<T>
>;

export function inputType<Config extends ConfigBase, T>(): <
  const Input extends InputTypeInput<T>
>(
  input: Input
) => InputTypeOutput<Config, T, Input> {
  return inputTypeInternal;
}

function inputTypeInternal<
  Config extends ConfigBase,
  T,
  Input extends InputTypeInput<T>
>(input: Input): InputTypeOutput<Config, T, Input> {
  const result: Omit<InputTypeOutput<Config, T, Input>, " onlyOnTypes"> = {
    kind: "input",
    name: input.name,
    internal: (incomplete) => inputTypeImpl(incomplete, input),
  };
  return result as InputTypeOutput<Config, T, Input>;
}

function inputTypeImpl<Config extends ConfigBase>(
  incomplete: IncompleteSchema<Config, TypeMapBase<Config>>,
  { name, description, fields }: InputTypeInput<unknown>
): GraphQLInputObjectType {
  let lazilyResolvedFields: Record<string, GraphQLInputFieldConfig> | undefined;
  return new GraphQLInputObjectType({
    name,
    description,
    fields: () =>
      (lazilyResolvedFields ??= Object.fromEntries(
        Object.entries(fields).map(
          ([key, field]): [string, GraphQLInputFieldConfig] => {
            const { type, description, deprecationReason, defaultValue } =
              field as InputTypeInputField<unknown>;
            return [
              key,
              {
                type: incomplete.getType(type) as GraphQLInputType,
                description,
                deprecationReason,
                defaultValue,
              },
            ];
          }
        )
      )),
  });
}

interface UnionTypeInput {
  name: string;
  description?: string;
  types: string[];
}

export interface UnionTypeOutput<
  Config extends ConfigBase,
  T,
  Input extends UnionTypeInput
> {
  kind: "union";
  name: Input["name"];
  internal: (
    incomplete: IncompleteSchema<Config, TypeMapBase<Config>>
  ) => GraphQLUnionType;
  " onlyOnTypes": UnionTypeOutputInternal<T, Input>;
}

interface UnionTypeOutputInternal<T, Input extends UnionTypeInput> {
  type: T;
  input: Input;
}

export type AnyUnionTypeOutput<Config extends ConfigBase, T> = UnionTypeOutput<
  Config,
  unknown,
  UnionTypeInput
>;

export function unionType<Config extends ConfigBase, T>(): <
  const Input extends UnionTypeInput // TODO: add type for T
>(
  input: Input
) => UnionTypeOutput<Config, T, Input> {
  return unionTypeInternal;
}

function unionTypeInternal<
  Config extends ConfigBase,
  T,
  Input extends UnionTypeInput
>(input: Input): UnionTypeOutput<Config, T, Input> {
  const result: Omit<UnionTypeOutput<Config, T, Input>, " onlyOnTypes"> = {
    kind: "union",
    name: input.name,
    internal: (incomplete) => unionTypeImpl(incomplete, input),
  };
  return result as UnionTypeOutput<Config, T, Input>;
}

function unionTypeImpl<Config extends ConfigBase, Input extends UnionTypeInput>(
  incomplete: IncompleteSchema<Config, TypeMapBase<Config>>,
  input: Input
): GraphQLUnionType {
  let lazilyResolvedTypes: GraphQLObjectType[] | undefined;
  return new GraphQLUnionType({
    name: input.name,
    description: input.description,
    types: () =>
      (lazilyResolvedTypes ??= input.types.map(
        (type) =>
          incomplete.getType({ nullable: true, type }) as GraphQLObjectType
      )),
  });
}

type AnyTypeOutput<Config extends ConfigBase> =
  | AnyObjectTypeOutput<Config, unknown>
  | AnyInterfaceTypeOutput<Config, unknown>
  | AnyScalarTypeOutput<unknown>
  | AnyEnumTypeOutput<string>
  | AnyInputTypeOutput<Config, unknown>
  | AnyUnionTypeOutput<Config, unknown>;

export type AnyBuilder<Config extends ConfigBase> = Builder<
  Config,
  Partial<Record<string, AnyObjectTypeOutput<Config, unknown>>>,
  Partial<Record<string, AnyInterfaceTypeOutput<Config, unknown>>>,
  Partial<Record<string, AnyScalarTypeOutput<unknown>>>,
  Partial<Record<string, AnyEnumTypeOutput<string>>>,
  Partial<Record<string, AnyInputTypeOutput<Config, unknown>>>,
  Partial<Record<string, AnyUnionTypeOutput<Config, unknown>>>
>;

class Builder<
  Config extends ConfigBase,
  ObjectTypes extends Partial<
    Record<string, AnyObjectTypeOutput<Config, unknown>>
  >,
  InterfaceTypes extends Partial<
    Record<string, AnyInterfaceTypeOutput<Config, unknown>>
  >,
  ScalarTypes extends Partial<Record<string, AnyScalarTypeOutput<unknown>>>,
  EnumTypes extends Partial<Record<string, AnyEnumTypeOutput<string>>>,
  InputTypes extends Partial<
    Record<string, AnyInputTypeOutput<Config, unknown>>
  >,
  UnionTypes extends Partial<
    Record<string, AnyUnionTypeOutput<Config, unknown>>
  >
> {
  private constructor(
    public readonly inputMap: ObjectTypes &
      InterfaceTypes &
      ScalarTypes &
      EnumTypes &
      InputTypes &
      UnionTypes
  ) {}

  public static create<Config extends ConfigBase>(): Builder<
    Config,
    {},
    {},
    {},
    {},
    {},
    {}
  > {
    return new Builder({});
  }

  public register<
    const Input extends (
      | AnyObjectTypeOutput<Config, any>
      | AnyInterfaceTypeOutput<Config, any>
      | AnyScalarTypeOutput<any>
      | AnyEnumTypeOutput<string>
      | AnyInputTypeOutput<Config, any>
      | AnyUnionTypeOutput<Config, any>
    )[]
  >(
    ...input: Input
  ): RegisterResult<
    Config,
    ObjectTypes,
    InterfaceTypes,
    ScalarTypes,
    EnumTypes,
    InputTypes,
    UnionTypes,
    Input
  >;
  public register(...input: AnyTypeOutput<Config>[]): unknown {
    const inputMap: Partial<Record<string, AnyTypeOutput<Config>>> = {
      ...this.inputMap,
    };
    input.forEach((item) => {
      inputMap[item.name] = item;
    });
    return new Builder<Config, {}, {}, {}, {}, {}, {}>(inputMap);
  }

  public build(
    input: BuildInput<Config, ObjectTypes>
  ): Schema<
    Config,
    ObjectTypes &
      InterfaceTypes &
      ScalarTypes &
      EnumTypes &
      InputTypes &
      UnionTypes
  >;
  public build(): unknown {
    const incomplete = new IncompleteSchema(this.inputMap);
    Object.keys(this.inputMap).forEach((type) => {
      incomplete.getType({ nullable: true, type });
    });
    return incomplete.assumeComplete();
  }
}

export type BuildInput<
  Config extends ConfigBase,
  ObjectTypes extends Partial<
    Record<string, AnyObjectTypeOutput<Config, unknown>>
  >
> = "Query" extends keyof ObjectTypes
  ? "Mutation" extends keyof ObjectTypes
    ? {
        Query: NonNullable<ObjectTypes["Query"]>[" onlyOnTypes"]["type"];
        Mutation: NonNullable<ObjectTypes["Mutation"]>[" onlyOnTypes"]["type"];
      }
    : never
  : never;

type TypeMapBase<Config extends ConfigBase> = Partial<
  Record<
    string,
    | AnyObjectTypeOutput<Config, unknown>
    | AnyInterfaceTypeOutput<Config, unknown>
    | AnyScalarTypeOutput<unknown>
    | AnyInputTypeOutput<Config, unknown>
    | AnyEnumTypeOutput<string>
    | AnyUnionTypeOutput<Config, unknown>
  >
>;

type TypeMapBaseToTypeMap<
  Config extends ConfigBase,
  TypeMap extends TypeMapBase<Config>
> = {
  [K in keyof TypeMap]: NonNullable<TypeMap[K]> extends Record<"kind", "object">
    ? GraphQLObjectType
    : NonNullable<TypeMap[K]> extends Record<"kind", "interface">
    ? GraphQLInterfaceType
    : NonNullable<TypeMap[K]> extends Record<"kind", "scalar">
    ? GraphQLScalarType
    : NonNullable<TypeMap[K]> extends Record<"kind", "enum">
    ? GraphQLEnumType
    : NonNullable<TypeMap[K]> extends Record<"kind", "input">
    ? GraphQLInputObjectType
    : NonNullable<TypeMap[K]> extends Record<"kind", "union">
    ? GraphQLUnionType
    : never;
};

class IncompleteSchema<
  Config extends ConfigBase,
  TypeMap extends TypeMapBase<Config>
> {
  public typeMap: Partial<TypeMapBaseToTypeMap<Config, TypeMap>>;

  constructor(
    public readonly inputMap: Partial<Record<string, AnyTypeOutput<Config>>>
  ) {
    this.typeMap = {};
  }

  getType(typeDescriptor: TypeDescriptor<any>): GraphQLType {
    if (!typeDescriptor.nullable) {
      return new GraphQLNonNull(
        this.getType({ nullable: true, type: typeDescriptor.type })
      );
    } else if (typeof typeDescriptor.type !== "string") {
      return new GraphQLList(this.getType(typeDescriptor.type));
    } else {
      switch (typeDescriptor.type) {
        case "String":
          return GraphQLString;
        case "ID":
          return GraphQLID;
        case "Boolean":
          return GraphQLBoolean;
        case "Int":
          return GraphQLInt;
        case "Float":
          return GraphQLFloat;
        default:
          const result = this.typeMap[typeDescriptor.type];
          if (result) {
            return result;
          }
          const newResult = this.inputMap[typeDescriptor.type]!.internal(this);
          (this.typeMap as Partial<Record<string, GraphQLType>>)[
            typeDescriptor.type
          ] = newResult;
          return newResult;
      }
    }
  }

  assumeComplete(): Schema<Config, TypeMap> {
    return new Schema(this.typeMap as TypeMapBaseToTypeMap<Config, TypeMap>);
  }
}

class Schema<Config extends ConfigBase, TypeMap extends TypeMapBase<Config>> {
  public readonly schema: GraphQLSchema;

  constructor(public typeMap: TypeMapBaseToTypeMap<Config, TypeMap>) {
    this.schema = new GraphQLSchema({
      query: this.typeMap.Query as GraphQLObjectType,
      mutation: this.typeMap.Mutation as GraphQLObjectType,
      types: Object.values(this.typeMap),
    });
  }
}

export type { Schema };

export const create = Builder.create;

export type RegisterResult<
  Config extends ConfigBase,
  ObjectTypes extends Partial<
    Record<string, AnyObjectTypeOutput<Config, unknown>>
  >,
  InterfaceTypes extends Partial<
    Record<string, AnyInterfaceTypeOutput<Config, unknown>>
  >,
  ScalarTypes extends Partial<Record<string, AnyScalarTypeOutput<unknown>>>,
  EnumTypes extends Partial<Record<string, AnyEnumTypeOutput<string>>>,
  InputTypes extends Partial<
    Record<string, AnyInputTypeOutput<Config, unknown>>
  >,
  UnionTypes extends Partial<
    Record<string, AnyUnionTypeOutput<Config, unknown>>
  >,
  Input extends AnyTypeOutput<Config>[]
> = Input extends [
  infer I extends
    | AnyObjectTypeOutput<Config, any>
    | AnyInterfaceTypeOutput<Config, any>
    | AnyScalarTypeOutput<any>
    | AnyEnumTypeOutput<string>
    | AnyInputTypeOutput<Config, any>
    | AnyUnionTypeOutput<Config, any>,
  ...infer Rest extends (
    | AnyObjectTypeOutput<Config, any>
    | AnyInterfaceTypeOutput<Config, any>
    | AnyScalarTypeOutput<any>
    | AnyEnumTypeOutput<string>
    | AnyInputTypeOutput<Config, any>
    | AnyUnionTypeOutput<Config, any>
  )[]
]
  ? I extends AnyObjectTypeOutput<Config, any>
    ? RegisterResultForObjectType<
        Config,
        ObjectTypes,
        InterfaceTypes,
        ScalarTypes,
        EnumTypes,
        InputTypes,
        UnionTypes,
        I,
        Rest
      >
    : I extends AnyInterfaceTypeOutput<Config, any>
    ? RegisterResultForInterfaceType<
        Config,
        ObjectTypes,
        InterfaceTypes,
        ScalarTypes,
        EnumTypes,
        InputTypes,
        UnionTypes,
        I,
        Rest
      >
    : I extends AnyScalarTypeOutput<any>
    ? RegisterResultForScalarType<
        Config,
        ObjectTypes,
        InterfaceTypes,
        ScalarTypes,
        EnumTypes,
        InputTypes,
        UnionTypes,
        I,
        Rest
      >
    : I extends AnyEnumTypeOutput<string>
    ? RegisterResultForEnumType<
        Config,
        ObjectTypes,
        InterfaceTypes,
        ScalarTypes,
        EnumTypes,
        InputTypes,
        UnionTypes,
        I,
        Rest
      >
    : I extends AnyInputTypeOutput<Config, any>
    ? RegisterResultForInputType<
        Config,
        ObjectTypes,
        InterfaceTypes,
        ScalarTypes,
        EnumTypes,
        InputTypes,
        UnionTypes,
        I,
        Rest
      >
    : I extends AnyUnionTypeOutput<Config, any>
    ? RegisterResultForUnionType<
        Config,
        ObjectTypes,
        InterfaceTypes,
        ScalarTypes,
        EnumTypes,
        InputTypes,
        UnionTypes,
        I,
        Rest
      >
    : "Internal error happened. please report this issue"
  : Builder<
      Config,
      ObjectTypes,
      InterfaceTypes,
      ScalarTypes,
      EnumTypes,
      InputTypes,
      UnionTypes
    >;

type RegisterResultForObjectType<
  Config extends ConfigBase,
  ObjectTypes extends Partial<
    Record<string, AnyObjectTypeOutput<Config, unknown>>
  >,
  InterfaceTypes extends Partial<
    Record<string, AnyInterfaceTypeOutput<Config, unknown>>
  >,
  ScalarTypes extends Partial<Record<string, AnyScalarTypeOutput<unknown>>>,
  EnumTypes extends Partial<Record<string, AnyEnumTypeOutput<string>>>,
  InputTypes extends Partial<
    Record<string, AnyInputTypeOutput<Config, unknown>>
  >,
  UnionTypes extends Partial<
    Record<string, AnyUnionTypeOutput<Config, unknown>>
  >,
  CurrentInput extends AnyObjectTypeOutput<Config, any>,
  Rest extends AnyTypeOutput<Config>[]
> = RegisterErrorForObjectType<
  Config,
  ObjectTypes,
  InterfaceTypes,
  ScalarTypes,
  EnumTypes,
  InputTypes,
  UnionTypes,
  CurrentInput
> extends infer I extends string
  ? [I] extends [never]
    ? RegisterResult<
        Config,
        ObjectTypes &
          Record<CurrentInput[" onlyOnTypes"]["input"]["name"], CurrentInput>,
        InterfaceTypes,
        ScalarTypes,
        EnumTypes,
        InputTypes,
        UnionTypes,
        Rest
      >
    : I
  : never;

type RegisterResultForInterfaceType<
  Config extends ConfigBase,
  ObjectTypes extends Partial<
    Record<string, AnyObjectTypeOutput<Config, unknown>>
  >,
  InterfaceTypes extends Partial<
    Record<string, AnyInterfaceTypeOutput<Config, unknown>>
  >,
  ScalarTypes extends Partial<Record<string, AnyScalarTypeOutput<unknown>>>,
  EnumTypes extends Partial<Record<string, AnyEnumTypeOutput<string>>>,
  InputTypes extends Partial<
    Record<string, AnyInputTypeOutput<Config, unknown>>
  >,
  UnionTypes extends Partial<
    Record<string, AnyUnionTypeOutput<Config, unknown>>
  >,
  CurrentInput extends AnyInterfaceTypeOutput<Config, any>,
  Rest extends AnyTypeOutput<Config>[]
> = RegisterErrorForInterfaceType<
  Config,
  ObjectTypes,
  InterfaceTypes,
  ScalarTypes,
  EnumTypes,
  InputTypes,
  UnionTypes,
  CurrentInput
> extends infer I extends string
  ? [I] extends [never]
    ? RegisterResult<
        Config,
        ObjectTypes,
        InterfaceTypes &
          Record<CurrentInput[" onlyOnTypes"]["input"]["name"], CurrentInput>,
        ScalarTypes,
        EnumTypes,
        InputTypes,
        UnionTypes,
        Rest
      >
    : I
  : never;

type RegisterResultForScalarType<
  Config extends ConfigBase,
  ObjectTypes extends Partial<
    Record<string, AnyObjectTypeOutput<Config, unknown>>
  >,
  InterfaceTypes extends Partial<
    Record<string, AnyInterfaceTypeOutput<Config, unknown>>
  >,
  ScalarTypes extends Partial<Record<string, AnyScalarTypeOutput<unknown>>>,
  EnumTypes extends Partial<Record<string, AnyEnumTypeOutput<string>>>,
  InputTypes extends Partial<
    Record<string, AnyInputTypeOutput<Config, unknown>>
  >,
  UnionTypes extends Partial<
    Record<string, AnyUnionTypeOutput<Config, unknown>>
  >,
  CurrentInput extends AnyScalarTypeOutput<any>,
  Rest extends AnyTypeOutput<Config>[]
> = RegisterErrorForScalarType<
  Config,
  ObjectTypes,
  InterfaceTypes,
  ScalarTypes,
  EnumTypes,
  InputTypes,
  UnionTypes,
  CurrentInput
> extends infer I extends string
  ? [I] extends [never]
    ? RegisterResult<
        Config,
        ObjectTypes,
        InterfaceTypes,
        ScalarTypes &
          Record<CurrentInput[" onlyOnTypes"]["input"]["name"], CurrentInput>,
        EnumTypes,
        InputTypes,
        UnionTypes,
        Rest
      >
    : I
  : never;

type RegisterResultForEnumType<
  Config extends ConfigBase,
  ObjectTypes extends Partial<
    Record<string, AnyObjectTypeOutput<Config, unknown>>
  >,
  InterfaceTypes extends Partial<
    Record<string, AnyInterfaceTypeOutput<Config, unknown>>
  >,
  ScalarTypes extends Partial<Record<string, AnyScalarTypeOutput<unknown>>>,
  EnumTypes extends Partial<Record<string, AnyEnumTypeOutput<string>>>,
  InputTypes extends Partial<
    Record<string, AnyInputTypeOutput<Config, unknown>>
  >,
  UnionTypes extends Partial<
    Record<string, AnyUnionTypeOutput<Config, unknown>>
  >,
  CurrentInput extends AnyEnumTypeOutput<string>,
  Rest extends AnyTypeOutput<Config>[]
> = RegisterErrorForEnumType<
  Config,
  ObjectTypes,
  InterfaceTypes,
  ScalarTypes,
  EnumTypes,
  InputTypes,
  UnionTypes,
  CurrentInput
> extends infer I extends string
  ? [I] extends [never]
    ? RegisterResult<
        Config,
        ObjectTypes,
        InterfaceTypes,
        ScalarTypes,
        EnumTypes &
          Record<CurrentInput[" onlyOnTypes"]["input"]["name"], CurrentInput>,
        InputTypes,
        UnionTypes,
        Rest
      >
    : I
  : never;

type RegisterResultForInputType<
  Config extends ConfigBase,
  ObjectTypes extends Partial<
    Record<string, AnyObjectTypeOutput<Config, unknown>>
  >,
  InterfaceTypes extends Partial<
    Record<string, AnyInterfaceTypeOutput<Config, unknown>>
  >,
  ScalarTypes extends Partial<Record<string, AnyScalarTypeOutput<unknown>>>,
  EnumTypes extends Partial<Record<string, AnyEnumTypeOutput<string>>>,
  InputTypes extends Partial<
    Record<string, AnyInputTypeOutput<Config, unknown>>
  >,
  UnionTypes extends Partial<
    Record<string, AnyUnionTypeOutput<Config, unknown>>
  >,
  CurrentInput extends AnyInputTypeOutput<Config, any>,
  Rest extends AnyTypeOutput<Config>[]
> = RegisterErrorForInputType<
  Config,
  ObjectTypes,
  InterfaceTypes,
  ScalarTypes,
  EnumTypes,
  InputTypes,
  UnionTypes,
  CurrentInput
> extends infer I extends string
  ? [I] extends [never]
    ? RegisterResult<
        Config,
        ObjectTypes,
        InterfaceTypes,
        ScalarTypes,
        EnumTypes,
        InputTypes &
          Record<CurrentInput[" onlyOnTypes"]["input"]["name"], CurrentInput>,
        UnionTypes,
        Rest
      >
    : I
  : never;

type RegisterResultForUnionType<
  Config extends ConfigBase,
  ObjectTypes extends Partial<
    Record<string, AnyObjectTypeOutput<Config, unknown>>
  >,
  InterfaceTypes extends Partial<
    Record<string, AnyInterfaceTypeOutput<Config, unknown>>
  >,
  ScalarTypes extends Partial<Record<string, AnyScalarTypeOutput<unknown>>>,
  EnumTypes extends Partial<Record<string, AnyEnumTypeOutput<string>>>,
  InputTypes extends Partial<
    Record<string, AnyInputTypeOutput<Config, unknown>>
  >,
  UnionTypes extends Partial<
    Record<string, AnyUnionTypeOutput<Config, unknown>>
  >,
  CurrentInput extends AnyUnionTypeOutput<Config, any>,
  Rest extends AnyTypeOutput<Config>[]
> = RegisterErrorForUnionType<
  Config,
  ObjectTypes,
  InterfaceTypes,
  ScalarTypes,
  EnumTypes,
  InputTypes,
  UnionTypes,
  CurrentInput
> extends infer I extends string
  ? [I] extends [never]
    ? RegisterResult<
        Config,
        ObjectTypes,
        InterfaceTypes,
        ScalarTypes,
        EnumTypes,
        InputTypes,
        UnionTypes &
          Record<CurrentInput[" onlyOnTypes"]["input"]["name"], CurrentInput>,
        Rest
      >
    : I
  : never;

type RegisterErrorForObjectType<
  Config extends ConfigBase,
  ObjectTypes extends Partial<
    Record<string, AnyObjectTypeOutput<Config, unknown>>
  >,
  InterfaceTypes extends Partial<
    Record<string, AnyInterfaceTypeOutput<Config, unknown>>
  >,
  ScalarTypes extends Partial<Record<string, AnyScalarTypeOutput<unknown>>>,
  EnumTypes extends Partial<Record<string, AnyEnumTypeOutput<string>>>,
  InputTypes extends Partial<
    Record<string, AnyInputTypeOutput<Config, unknown>>
  >,
  UnionTypes extends Partial<
    Record<string, AnyUnionTypeOutput<Config, unknown>>
  >,
  Input extends AnyObjectTypeOutput<Config, any>
> = never; // TODO: implement this

type RegisterErrorForInterfaceType<
  Config extends ConfigBase,
  ObjectTypes extends Partial<
    Record<string, AnyObjectTypeOutput<Config, unknown>>
  >,
  InterfaceTypes extends Partial<
    Record<string, AnyInterfaceTypeOutput<Config, unknown>>
  >,
  ScalarTypes extends Partial<Record<string, AnyScalarTypeOutput<unknown>>>,
  EnumTypes extends Partial<Record<string, AnyEnumTypeOutput<string>>>,
  InputTypes extends Partial<
    Record<string, AnyInputTypeOutput<Config, unknown>>
  >,
  UnionTypes extends Partial<
    Record<string, AnyUnionTypeOutput<Config, unknown>>
  >,
  Input extends AnyInterfaceTypeOutput<Config, any>
> = never; // TODO: implement this

type RegisterErrorForScalarType<
  Config extends ConfigBase,
  ObjectTypes extends Partial<
    Record<string, AnyObjectTypeOutput<Config, unknown>>
  >,
  InterfaceTypes extends Partial<
    Record<string, AnyInterfaceTypeOutput<Config, unknown>>
  >,
  ScalarTypes extends Partial<Record<string, AnyScalarTypeOutput<unknown>>>,
  EnumTypes extends Partial<Record<string, AnyEnumTypeOutput<string>>>,
  InputTypes extends Partial<
    Record<string, AnyInputTypeOutput<Config, unknown>>
  >,
  UnionTypes extends Partial<
    Record<string, AnyUnionTypeOutput<Config, unknown>>
  >,
  Input extends AnyScalarTypeOutput<any>
> = never; // TODO: implement this

type RegisterErrorForEnumType<
  Config extends ConfigBase,
  ObjectTypes extends Partial<
    Record<string, AnyObjectTypeOutput<Config, unknown>>
  >,
  InterfaceTypes extends Partial<
    Record<string, AnyInterfaceTypeOutput<Config, unknown>>
  >,
  ScalarTypes extends Partial<Record<string, AnyScalarTypeOutput<unknown>>>,
  EnumTypes extends Partial<Record<string, AnyEnumTypeOutput<string>>>,
  InputTypes extends Partial<
    Record<string, AnyInputTypeOutput<Config, unknown>>
  >,
  UnionTypes extends Partial<
    Record<string, AnyUnionTypeOutput<Config, unknown>>
  >,
  Input extends AnyEnumTypeOutput<string>
> = never; // TODO: implement this

type RegisterErrorForInputType<
  Config extends ConfigBase,
  ObjectTypes extends Partial<
    Record<string, AnyObjectTypeOutput<Config, unknown>>
  >,
  InterfaceTypes extends Partial<
    Record<string, AnyInterfaceTypeOutput<Config, unknown>>
  >,
  ScalarTypes extends Partial<Record<string, AnyScalarTypeOutput<unknown>>>,
  EnumTypes extends Partial<Record<string, AnyEnumTypeOutput<string>>>,
  InputTypes extends Partial<
    Record<string, AnyInputTypeOutput<Config, unknown>>
  >,
  UnionTypes extends Partial<
    Record<string, AnyUnionTypeOutput<Config, unknown>>
  >,
  Input extends AnyInputTypeOutput<Config, any>
> = never; // TODO: implement this

type RegisterErrorForUnionType<
  Config extends ConfigBase,
  ObjectTypes extends Partial<
    Record<string, AnyObjectTypeOutput<Config, unknown>>
  >,
  InterfaceTypes extends Partial<
    Record<string, AnyInterfaceTypeOutput<Config, unknown>>
  >,
  ScalarTypes extends Partial<Record<string, AnyScalarTypeOutput<unknown>>>,
  EnumTypes extends Partial<Record<string, AnyEnumTypeOutput<string>>>,
  InputTypes extends Partial<
    Record<string, AnyInputTypeOutput<Config, unknown>>
  >,
  UnionTypes extends Partial<
    Record<string, AnyUnionTypeOutput<Config, unknown>>
  >,
  Input extends AnyUnionTypeOutput<Config, any>
> = never; // TODO: implement this
