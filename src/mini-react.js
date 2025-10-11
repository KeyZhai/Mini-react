const createElement = (type, props, ...children) => {
  return {
    type,
    props: {
      ...props,
      children: children.map((child) => {
        const isTextNode =
          typeof child === "string" || typeof child === "number";
        return isTextNode ? createTextNode(child) : child;
      }),
    },
  };
};

const createTextNode = (nodeValue) => {
  return {
    type: "TEXT_NODE",
    props: {
      nodeValue,
      children: [],
    },
  };
};

let nextUnitOfWork = null;
let wipRoot = null;
let currentRoot = null;

const render = (element, container) => {
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot,
  };
  //nextUnitOfWork 指向下一个工作单元
  nextUnitOfWork = wipRoot;
};

const workLoop = (deadline) => {
  let shouldYield = false;
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    shouldYield = deadline.timeRemaining() < 1;
  }
  requestIdleCallback(workLoop);
};

const performUnitOfWork = (fiber) => {
  const isFunctionComponent = fiber.type instanceof Function;
  if (isFunctionComponent) {
    updateFunctionComponent(fiber);
  } else {
    updateHostComponent(fiber);
  }
  if (fiber.child) {
    return fiber.child;
  }
  let nextFiber = fiber;
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling;
    }
    nextFiber = nextFiber.return;
  }
};

//wipFiber 指向当前正在处理的 fiber 节点
let wipFiber = null;
let stateHookIndex = null;

const updateFunctionComponent = (fiber) => {
  wipFiber = fiber;
  stateHookIndex = 0;
  wipFiber.stateHooks = [];
  wipFiber.effectHooks = [];

  const children = [fiber.type(fiber.props)];
  reconcileChildren(fiber, children);
};

const updateHostComponent = (fiber) => {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }
  const elements = fiber.props.children;
  reconcileChildren(fiber, elements);
};

const createDom = (fiber) => {
  const dom =
    fiber.type === "TEXT_ELEMENT"
      ? document.createTextNode("")
      : document.createElement(fiber.type);
  updateDom(dom, {}, fiber.props);
  return dom;
};

const isEvent = (key) => key.startsWith("on");
const isProperty = (key) => key !== "children" && !isEvent(key);
const isNew = (prev, next) => (key) => prev[key] !== next[key];
const isGone = (prev, next) => (key) => !(key in next);

const updateDom = (dom, prevProps, nextProps) => {
  // remove old or changed event listeners
  Object.keys(prevProps)
    .filter(isEvent)
    .filter((key) => !(key in nextProps) || isNew(prevProps, nextProps)(key))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2);
      dom.removeEventListener(eventType, prevProps[name]);
    });
  // remove old properties
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach((name) => {
      dom[name] = "";
    });
  // set new or changed properties
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      dom[name] = nextProps[name];
    });
  // add event listeners
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2);
      dom.addEventListener(eventType, nextProps[name]);
    });
};

const reconcileChildren = (wipFiber, elements) => {
  let index = 0;
  let oldFiber = wipFiber.alternate?.child;
  let prevSibling = null; // 用于构建新 Fiber 节点的 sibling 链表

  const element = elements[index];
  let newFiber = null;
  const sameType = oldFiber && element && element.type === oldFiber.type;
  // 更新节点
  if (sameType) {
    newFiber = {
      type: oldFiber.type,
      props: element.props,
      dom: oldFiber.dom,
      return: wipFiber,
      alternate: oldFiber,
      effectTag: "UPDATE",
    };
  }
  // 新增节点
  if (!sameType && element) {
    newFiber = {
      type: element.type,
      props: element.props,
      dom: null, //dom在后续 commit 阶段创建
      return: wipFiber,
      alternate: null, //新创建的 fiber 没有 alternate
      effectTag: "PLACEMENT",
    };
  }
  // 删除节点
  if (oldFiber && !sameType) {
    oldFiber.effectTag = "DELETION";
    deletions.push(oldFiber);
  }
  if (oldFiber) {
    oldFiber = oldFiber.sibling;
  }
  if (index === 0) {
    wipFiber.child = newFiber;
  } else if (element) {
    prevSibling.sibling = newFiber;
  }
  prevSibling = newFiber;
  index++;
};

requestIdleCallback(workLoop);

const MiniReact = {
  createElement,
};

window.MiniReact = MiniReact;
