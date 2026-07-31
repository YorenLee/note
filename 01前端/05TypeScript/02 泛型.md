# 泛型（Generics）

## 泛型函数类型

泛型函数类型与非泛型函数类型类似，只是前面多了类型参数列表。

### 三种写法

#### 1. 箭头函数类型（最简洁）

```ts
let myIdentity: <Type>(arg: Type) => Type = identity;
```

直接在类型注解中写泛型箭头函数签名。泛型参数名可以随意取：

```ts
let myIdentity: <Input>(arg: Input) => Input = identity;
```

> `:` 后面是**类型注解**，`=` 后面是**赋值**。这里把 `identity` 函数赋给 `myIdentity` 变量。

#### 2. 对象字面量调用签名

```ts
let myIdentity: { <Type>(arg: Type): Type } = identity;
```

把泛型调用签名写在 `{}` 里。这是接口形式的过渡写法。

#### 3. 泛型接口（两种子形式）

**子形式 A — 泛型参数在调用签名上：**

```ts
interface GenericIdentityFn {
  <Type>(arg: Type): Type;
}
let myIdentity: GenericIdentityFn = identity;
```

泛型参数属于方法本身，接口不绑定具体类型，使用时无需指定类型参数。

**子形式 B — 泛型参数在接口上：**

```ts
interface GenericIdentityFn<Type> {
  (arg: Type): Type;
}
let myIdentity: GenericIdentityFn<number> = identity;
```

泛型参数属于整个接口，使用时必须指定具体类型，接口内所有成员共享同一个类型参数。好处是可以看到泛型的具体类型（如 `Dictionary<string>`）。

### 两种接口形式的区别

| | 子形式 A（参数在方法上） | 子形式 B（参数在接口上） |
|---|---|---|
| 泛型作用域 | 每次调用独立 | 整个接口共享 |
| 使用时 | `GenericIdentityFn` | `GenericIdentityFn<number>` |
| 适用场景 | 函数本身是泛型的 | 想"具名"看到泛型类型 |

---

## 变体注解（Variance Annotations）

> 高级特性，只应在确实需要时才使用。TypeScript 会自动推断泛型的变体，绝大多数情况下不需要手动标注。

### 核心概念

#### 协变（Covariance）— `out T`

T 只作为**输出**（生产者），`Producer<Cat>` 可以用于 `Producer<Animal>` 的位置。关系方向和 T 的方向**一致**。

```ts
interface Producer<out T> {
  make(): T;  // T 只出现在返回值位置
}
```

#### 逆变（Contravariance）— `in T`

T 只作为**输入**（消费者），`Consumer<Animal>` 可以用于 `Consumer<Cat>` 的位置。关系方向和 T 的方向**相反**。

```ts
interface Consumer<in T> {
  consume: (arg: T) => void;  // T 只出现在参数位置
}
```

#### 不变（Invariance）— `in out T`

T 既作为输入又作为输出，不能协变也不能逆变。

```ts
interface ProducerConsumer<in out T> {
  consume: (arg: T) => void;  // T 作为输入
  make(): T;                  // T 作为输出
}
```

### 通俗理解

| 注解 | 含义 | 通俗说法 |
|---|---|---|
| `out T` | T 只出（返回值） | **生产者** — T 从函数里"出来" |
| `in T` | T 只进（参数） | **消费者** — T 被"吃进去" |
| `in out T` | T 又进又出 | **生产+消费** — 不变 |

### 重要规则

1. **变体注解只在"同类型实例化比较"时生效**，结构比较时不起作用。
2. **必须和结构变体一致** — 写错会报错（如给逆变接口标 `out` 编译报错）。
3. **不能用来"强制"改变类型检查行为**。
4. 只应在以下场景使用：
   - 临时调试变体问题（TypeScript 会检查注解是否正确）
   - 极端复杂的循环类型导致变体推断出错
   - 对性能极度敏感的复杂类型
