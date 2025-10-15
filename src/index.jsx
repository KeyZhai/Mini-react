// 1. 定义一个函数组件 Counter
function Counter() {
  const [count, setCount] = MiniReact.useState(0);

  // 新增 useEffect
  MiniReact.useEffect(() => {
    console.log(`Effect: Count is now ${count}`);
    // 模拟订阅操作
    const timerId = setInterval(() => {
      console.log(`Timer tick at count: ${count}`);
    }, 1000);

    // 返回清理函数
    return () => {
      console.log(`Cleanup: Clearing timer for count ${count}`);
      clearInterval(timerId);
    };
  }, [count]); // 依赖项是 count

  return MiniReact.createElement(
    "div",
    { onClick: () => setCount(count + 1) },
    `Count: ${count}`
  );
}

// 2. 创建 Counter 组件的 element
const counterElement = MiniReact.createElement(Counter);

// 3. 找到容器 DOM 并渲染
const container = document.getElementById("root");
MiniReact.render(counterElement, container);
