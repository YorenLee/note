# 装饰器（Decorators）

## 本质

装饰器就是一个**函数**，在类定义时被调用，对类、方法、属性做额外处理。写法和 `@xxx` 一样。

## 不带参数的装饰器

直接就是一个普通函数，TS 会把被装饰的目标传给它。函数签名固定三个参数：`target`、`propertyKey`、`descriptor`。

```ts
function Log(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) {
  console.log("正在装饰：", propertyKey);

  const originalMethod = descriptor.value;

  descriptor.value = function (...args: any[]) {
    console.log("==== 开始执行 ====");
    const result = originalMethod.apply(this, args);
    console.log("==== 执行结束 ====");
    return result;
  };
}

class Calculator {
  @Log
  add(a: number, b: number): number {
    return a + b;
  }
}
```

**执行流程**：`@Log` → 直接把 `add` 方法的 descriptor 传给 `Log` 函数 → 修改 `descriptor.value` 包装原方法。

**特点**：行为写死了，所有用 `@Log` 的地方打印的日志都一样，没法定制。

## 带参数的装饰器（装饰器工厂）

当需要根据参数产生不同行为时，装饰器本身就不能直接是函数了，得是一个**返回函数的函数**（工厂模式）。

```ts
function Log(module: string) {
  // ① 先执行这里：接收参数，创建装饰器
  console.log("创建装饰器：", module);

  // ② 返回真正的装饰器函数
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      console.log(`[${module}] 开始执行 ${propertyKey}`);
      const result = originalMethod.apply(this, args);
      console.log(`[${module}] 执行结束`);
      return result;
    };
  };
}

class App {
  @Log("Order")
  createOrder() {}

  @Log("User")
  createUser() {}
}
```

**执行流程**：

1. `@Log("Order")` → 先调用 `Log("Order")`，`module = "Order"`，运行时打印 `创建装饰器：Order`
2. 返回内层函数，作为真正的装饰器作用到 `createOrder` 方法上
3. 最终效果：`createOrder` 执行时打印 `[Order] 开始执行 createOrder`

## 核心区别一句话

| | 不带参 `@Log` | 带参 `@Log("xxx")` |
|---|---|---|
| `@` 后面是什么 | 直接是装饰器函数 | 先调工厂函数，返回装饰器函数 |
| 函数执行次数 | 1 层，函数就是装饰器 | 2 层，外层收参数，内层是装饰器 |
| 什么时候执行 | 类定义时执行装饰器 | 类定义时先执行工厂，再执行内层装饰器 |
| 适用场景 | 行为固定，不需要定制 | 同一装饰器需要不同行为，靠参数区分 |

**简单记**：

- 不带参 — 函数直接干活：`装饰器函数(target, key, descriptor)`
- 带参 — 先收参数再干活：`工厂(参数)` → `装饰器函数(target, key, descriptor)`

说白了，带参就是把装饰器"包了一层"，外层函数用闭包把参数传进去，内层函数才是真正改 `descriptor.value` 的装饰器。

---

## 五种装饰器类型

装饰器可以放在类、方法、访问器、属性、参数上，每种接收的 `target` 含义不同，能做的事也不一样。

### 1. Class Decorators（类装饰器）

放在类上，`target` 是**构造函数本身**。只有一个参数，没有 `propertyKey` 和 `descriptor`。

```ts
function Sealed(constructor: Function) {
  // constructor 就是这个类本身
  console.log("装饰类：", constructor.name);
  Object.seal(constructor);
  Object.seal(constructor.prototype);
}

@Sealed
class Person {
  name = "Alice";
}
```

**可以返回一个新类替换原来的**：

```ts
function AddTime<T extends { new (...args: any[]): {} }>(constructor: T) {
  return class extends constructor {
    createdAt = new Date(); // 给所有实例加一个字段
  };
}

@AddTime
class User {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
}

const u = new User("Alice");
console.log(u.createdAt); // ✅ 有值
```

**核心**：`target` = 构造函数，可以操作原型、返回新类替换。

### 2. Method Decorators（方法装饰器）

放在方法上，`target` 是**原型对象**（实例方法）或**构造函数**（静态方法）。有 `propertyKey` 和 `descriptor`，可以改 `descriptor.value` 包装方法。

```ts
function Log(
  target: any,             // 原型对象（实例方法）/ 构造函数（静态方法）
  propertyKey: string,     // 方法名
  descriptor: PropertyDescriptor  // { value, writable, enumerable, configurable }
) {
  const originalMethod = descriptor.value;

  descriptor.value = function (...args: any[]) {
    console.log(`调用 ${propertyKey}，参数：`, args);
    return originalMethod.apply(this, args);
  };
}

class Calc {
  @Log
  add(a: number, b: number) {
    return a + b;
  }
}
```

**核心**：`target` = 原型，通过 `descriptor.value` 偷换原方法，在外面包一层逻辑。

### 3. Accessor Decorators（访问器装饰器）

放在 `get`/`set` 上，参数签名和方法装饰器一样。区别是 `descriptor` 里有 `get`/`set`，没有 `value`。

```ts
function Validate(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor  // descriptor.get / descriptor.set
) {
  const originalSet = descriptor.set!;

  descriptor.set = function (value: number) {
    if (value < 0) {
      throw new Error(`${propertyKey} 不能为负数`);
    }
    originalSet.call(this, value);
  };
}

class Product {
  private _price = 0;

  @Validate
  set price(value: number) {
    this._price = value;
  }

  get price() {
    return this._price;
  }
}
```

**核心**：和方法装饰器一样，但操作的是 `descriptor.get` / `descriptor.set`。

### 4. Property Decorators（属性装饰器）

放在属性上，`target` 是**原型对象**，有 `propertyKey` 但**没有 `descriptor.value`**（类属性在初始化前还不存在值）。所以**不能直接修改属性值**，主要用于记元数据或配合 `Reflect` 使用。

```ts
function Required(target: any, propertyKey: string) {
  // target 是原型对象
  // propertyKey 是属性名
  // ⚠️ 这里拿不到属性值，value 还不存在
  console.log(`标记 ${propertyKey} 为必填`);
}

class User {
  @Required
  name: string;

  @Required
  email: string;
}
```

**核心**：只能拿到"属性在哪个原型上"和"叫什么名字"，拿不到值。真正做校验要配合第三方库（如 `class-validator`）在运行时通过 `Reflect.getMetadata` 读取元数据再校验实例。

### 5. Parameter Decorators（参数装饰器）

放在方法参数上，有三个参数：`target`（原型）、`propertyKey`（方法名）、`parameterIndex`（参数在第几个位置）。**只能记元数据，改不了任何东西**。

```ts
function Required(
  target: Object,
  propertyKey: string | symbol,
  parameterIndex: number
) {
  // parameterIndex 表示是第几个参数（从 0 开始）
  console.log(`${String(propertyKey)} 的第 ${parameterIndex} 个参数被标记为必填`);
}

class UserService {
  create(@Required name: string, @Required email: string) {
    console.log(`创建用户：${name}`);
  }
}

// 输出：
// create 的第 1 个参数被标记为必填
// create 的第 0 个参数被标记为必填
```

注意：**参数装饰器从右往左执行**，所以 `email`（index 1）先打印，`name`（index 0）后打印。

**核心**：只能标记位置信息，不返回任何东西。要真正做校验，得结合方法装饰器 + `Reflect.getMetadata` 读出所有被标记的参数索引，再在调用时检查。

---

## 五种装饰器对比一张表

| 类型 | 放在哪 | target 是什么 | 有什么参数 | 能做什么 | 最常用场景 |
|---|---|---|---|---|---|
| Class | 类上 | 构造函数 | `constructor` | 操作原型、替换类 | 给类加公共逻辑、注册到容器 |
| Method | 方法上 | 原型对象 | `target`, `key`, `descriptor` | **改 `descriptor.value` 包装方法** | 日志、计时、权限检查 |
| Accessor | get/set 上 | 原型对象 | `target`, `key`, `descriptor` | 改 `descriptor.get`/`set` | 数据校验、类型转换 |
| Property | 属性上 | 原型对象 | `target`, `key` | 记元数据（拿不到值） | 标记必填、标记字段含义 |
| Parameter | 参数上 | 原型对象 | `target`, `key`, `index` | 记元数据（改不了任何东西） | 配合框架做依赖注入、参数校验 |

**一句话总结**：Method 和 Accessor 可以"动手"（改 descriptor），Property 和 Parameter 只能"动嘴"（记元数据），Class 最特殊 — 能直接换掉整个类。
