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

const MiniReact = {
  createElement,
};

window.MiniReact = MiniReact;
