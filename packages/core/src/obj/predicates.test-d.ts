import { Assert } from '#kitz/assert'
import { Obj } from '#obj'

const A = Assert.Type.exact.ofAs

// HasRequiredKeys tests
{
  type AllRequired = { a: string; b: number }
  type AllOptional = { a?: string; b?: number }
  type Mixed = { a: string; b?: number }
  type Empty = {}

  A<true>().onAs<Obj.HasRequiredKeys<AllRequired>>()
  A<false>().onAs<Obj.HasRequiredKeys<AllOptional>>()
  A<true>().onAs<Obj.HasRequiredKeys<Mixed>>()
  A<false>().onAs<Obj.HasRequiredKeys<Empty>>()
}

// HasOptionalKeys tests
{
  type AllRequired = { a: string; b: number }
  type AllOptional = { a?: string; b?: number }
  type Mixed = { a: string; b?: number }
  type Empty = {}

  A<false>().onAs<Obj.HasOptionalKeys<AllRequired>>()
  A<true>().onAs<Obj.HasOptionalKeys<AllOptional>>()
  A<true>().onAs<Obj.HasOptionalKeys<Mixed>>()
  A<false>().onAs<Obj.HasOptionalKeys<Empty>>()
}

// RequiredKeys tests
{
  type Mixed = { a: string; b?: number; c?: boolean }

  A<'a'>().onAs<Obj.RequiredKeys<Mixed>>()
}

// OptionalKeys tests
{
  type Mixed = { a: string; b?: number; c?: boolean }

  A<'b' | 'c'>().onAs<Obj.OptionalKeys<Mixed>>()
}

// HasOptionalKey tests
{
  type TestObj = { a?: string; b: number }

  A<true>().onAs<Obj.HasOptionalKey<TestObj, 'a'>>()
  A<false>().onAs<Obj.HasOptionalKey<TestObj, 'b'>>()
}

// IsKeyOptional tests
{
  type TestObj = { a?: string; b: number }

  A<true>().onAs<Obj.IsKeyOptional<TestObj, 'a'>>()
  A<false>().onAs<Obj.IsKeyOptional<TestObj, 'b'>>()
  A<false>().onAs<Obj.IsKeyOptional<TestObj, 'c'>>()
}

// HasKey tests
{
  type TestObj = { a: string; b: number }

  A<true>().onAs<Obj.HasKey<TestObj, 'a'>>()
  A<true>().onAs<Obj.HasKey<TestObj, 'b'>>()
  A<false>().onAs<Obj.HasKey<TestObj, 'c'>>()
}
