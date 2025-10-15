"use strict";
(function () {
    //将 jsx => createElement
    function createElement(type, props, ...children) {
        return {
            type,
            props: Object.assign(Object.assign({}, props), { children: children.map((child) => {
                    const isTextNode = typeof child === "string" || typeof child === "number";
                    return isTextNode ? createTextNode(child) : child;
                }) }),
        };
    }
    function createTextNode(nodeValue) {
        return {
            type: "TEXT_ELEMENT",
            props: {
                nodeValue,
                children: [],
            },
        };
    }
    //下一个工作单元
    let nextUnitOfWork = null;
    //work in progress root (正在处理的 fiber 链表的根 root)
    let wipRoot = null;
    //之前的历史 fiber 链表的根 currentRoot
    let currentRoot = null;
    //记录需要删除的节点
    let deletions = null;
    //render => Element => Fiber(vdom)
    function render(element, container) {
        wipRoot = {
            dom: container,
            props: {
                children: [element],
            },
            alternate: currentRoot,
        };
        deletions = [];
        nextUnitOfWork = wipRoot;
    }
    //在浏览器空闲时执行任务
    function workLoop(deadline) {
        //记录是否停止
        let shouldYield = false;
        while (nextUnitOfWork && !shouldYield) {
            nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
            shouldYield = deadline.timeRemaining() < 1;
        }
        if (!nextUnitOfWork && wipRoot) {
            commitRoot();
        }
        requestIdleCallback(workLoop);
    }
    requestIdleCallback(workLoop);
    //执行当前工作单元，构建 fiber 树 => reconcile
    function performUnitOfWork(fiber) {
        const isFunctionComponent = fiber.type instanceof Function;
        if (isFunctionComponent) {
            updateFunctionComponent(fiber);
        }
        else {
            updateHostComponent(fiber);
        }
        //构建顺序：child -> sibling -> uncle
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
    }
    //work in progress fiber：正在处理的 fiber
    let wipFiber = null;
    //追踪当前正在处理的是第几个 useState hook
    let stateHookIndex = null;
    function updateFunctionComponent(fiber) {
        wipFiber = fiber;
        stateHookIndex = 0;
        wipFiber.stateHooks = [];
        wipFiber.effectHooks = [];
        const children = [fiber.type(fiber.props)];
        reconcileChildren(fiber, children);
    }
    function updateHostComponent(fiber) {
        if (!fiber.dom) {
            //只是创建 dom,存储在 fiber 上，还没有插入到页面
            fiber.dom = createDom(fiber);
        }
        reconcileChildren(fiber, fiber.props.children);
    }
    function createDom(fiber) {
        const dom = fiber.type == "TEXT_ELEMENT"
            ? document.createTextNode("")
            : document.createElement(fiber.type);
        updateDom(dom, {}, fiber.props);
        return dom;
    }
    const isEvent = (key) => key.startsWith("on");
    const isProperty = (key) => key !== "children" && !isEvent(key);
    const isNew = (prev, next) => (key) => prev[key] !== next[key];
    const isGone = (prev, next) => (key) => !(key in next);
    function updateDom(dom, prevProps, nextProps) {
        //Remove old or changed event listeners
        Object.keys(prevProps)
            .filter(isEvent)
            .filter((key) => !(key in nextProps) || isNew(prevProps, nextProps)(key))
            .forEach((name) => {
            const eventType = name.toLowerCase().substring(2);
            dom.removeEventListener(eventType, prevProps[name]);
        });
        // Remove old properties
        Object.keys(prevProps)
            .filter(isProperty)
            .filter(isGone(prevProps, nextProps))
            .forEach((name) => {
            dom[name] = "";
        });
        // Set new or changed properties
        Object.keys(nextProps)
            .filter(isProperty)
            .filter(isNew(prevProps, nextProps))
            .forEach((name) => {
            dom[name] = nextProps[name];
        });
        // Add event listeners
        Object.keys(nextProps)
            .filter(isEvent)
            .filter(isNew(prevProps, nextProps))
            .forEach((name) => {
            const eventType = name.toLowerCase().substring(2);
            dom.addEventListener(eventType, nextProps[name]);
        });
    }
    function reconcileChildren(wipFiber, elements) {
        var _a;
        // index 新子元素数组的索引
        let index = 0;
        // oldFiber 旧fiber 元素的第一个子节点
        let oldFiber = (_a = wipFiber.alternate) === null || _a === void 0 ? void 0 : _a.child;
        // 新 fiber 树的前一个兄弟节点
        let prevSibling = null;
        while (index < elements.length || oldFiber != null) {
            const element = elements[index];
            // 新的 fiber 节点
            let newFiber = null;
            const sameType = (element === null || element === void 0 ? void 0 : element.type) == (oldFiber === null || oldFiber === void 0 ? void 0 : oldFiber.type);
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
            if (element && !sameType) {
                newFiber = {
                    type: element.type,
                    props: element.props,
                    dom: null,
                    return: wipFiber,
                    alternate: null,
                    effectTag: "PLACEMENT",
                };
            }
            if (oldFiber && !sameType) {
                oldFiber.effectTag = "DELETION";
                deletions.push(oldFiber);
            }
            if (oldFiber) {
                oldFiber = oldFiber.sibling;
            }
            if (index === 0) {
                wipFiber.child = newFiber;
            }
            else if (element) {
                prevSibling.sibling = newFiber;
            }
            prevSibling = newFiber;
            index++;
        }
    }
    function useState(initialState) {
        var _a;
        const currentFiber = wipFiber;
        const oldHook = (_a = wipFiber.alternate) === null || _a === void 0 ? void 0 : _a.stateHooks[stateHookIndex];
        const stateHook = {
            state: oldHook ? oldHook.state : initialState,
            queue: oldHook ? oldHook.queue : [],
        };
        stateHook.queue.forEach((action) => {
            stateHook.state = action(stateHook.state);
        });
        stateHook.queue = [];
        stateHookIndex++;
        wipFiber.stateHooks.push(stateHook);
        function setState(action) {
            const isFunction = typeof action === "function";
            stateHook.queue.push(isFunction ? action : () => action);
            wipRoot = Object.assign(Object.assign({}, currentFiber), { alternate: currentFiber });
            nextUnitOfWork = wipRoot;
        }
        return [stateHook.state, setState];
    }
    function useEffect(callback, deps) {
        const effectHook = {
            callback,
            deps,
            cleanup: undefined,
        };
        wipFiber.effectHooks.push(effectHook);
    }
    function commitRoot() {
        //before mutation 更新 dom 前
        //执行 getSnapShotBeforeUpdate ，调度 useEffect(异步)
        const snapshot = wipRoot;
        requestIdleCallback(() => {
            commitEffectHooks(snapshot);
        });
        //mutation 更新 dom：mutation 阶段会把 reconcile 阶段创建好的 dom 更新到 dom 树
        deletions.forEach(commitWork);
        commitWork(wipRoot.child);
        currentRoot = wipRoot;
        wipRoot = null;
        deletions = [];
        //layout 更新 dom 后，paint之前 调度 useLayoutEffect(同步)
    }
    //递归的将 fiber 上的 dom 插入到页面
    function commitWork(fiber) {
        if (!fiber) {
            return;
        }
        let domParentFiber = fiber.return;
        while (!domParentFiber.dom) {
            domParentFiber = domParentFiber.return;
        }
        const domParent = domParentFiber.dom;
        if (fiber.effectTag === "PLACEMENT" && fiber.dom != null) {
            domParent.appendChild(fiber.dom);
        }
        else if (fiber.effectTag === "UPDATE" && fiber.dom != null) {
            updateDom(fiber.dom, fiber.alternate.props, fiber.props);
        }
        else if (fiber.effectTag === "DELETION") {
            commitDeletion(fiber, domParent);
        }
        commitWork(fiber.child);
        commitWork(fiber.sibling);
    }
    function commitDeletion(fiber, domParent) {
        if (fiber.dom) {
            domParent.removeChild(fiber.dom);
        }
        else {
            commitDeletion(fiber.child, domParent);
        }
    }
    function isDepsEqual(deps, newDeps) {
        if (deps.length !== newDeps.length) {
            return false;
        }
        for (let i = 0; i < deps.length; i++) {
            if (deps[i] !== newDeps[i]) {
                return false;
            }
        }
        return true;
    }
    function commitEffectHooks(root) {
        //先执行旧 fiber 树 useEffect 的返回的 cleanup
        function runCleanup(fiber) {
            var _a, _b;
            if (!fiber)
                return;
            (_b = (_a = fiber.alternate) === null || _a === void 0 ? void 0 : _a.effectHooks) === null || _b === void 0 ? void 0 : _b.forEach((hook, index) => {
                var _a;
                const deps = fiber.effectHooks[index].deps;
                if (!hook.deps || !isDepsEqual(hook.deps, deps)) {
                    (_a = hook.cleanup) === null || _a === void 0 ? void 0 : _a.call(hook);
                }
            });
            runCleanup(fiber.child);
            runCleanup(fiber.sibling);
        }
        //再执行新的 fiber 树 useEffect 的 callback
        function run(fiber) {
            var _a;
            if (!fiber)
                return;
            (_a = fiber.effectHooks) === null || _a === void 0 ? void 0 : _a.forEach((newHook, index) => {
                var _a;
                if (!fiber.alternate) {
                    newHook.cleanup = newHook.callback();
                    return;
                }
                if (!newHook.deps) {
                    newHook.cleanup = newHook.callback();
                }
                if (newHook.deps.length > 0) {
                    const oldHook = (_a = fiber.alternate) === null || _a === void 0 ? void 0 : _a.effectHooks[index];
                    if (!isDepsEqual(oldHook.deps, newHook.deps)) {
                        newHook.cleanup = newHook.callback();
                    }
                }
            });
            run(fiber.child);
            run(fiber.sibling);
        }
        runCleanup(root);
        run(root);
    }
    const MiniReact = {
        createElement,
        render,
        useState,
        useEffect,
    };
    window.MiniReact = MiniReact;
})();
