/**
 * Created by yaoshining on 16/3/14.
 */
function linkFunc(scope, elem) {
}

function NodeDirectiveFactory() {
    let directive = {
        restrict: 'AE',
        scope: false,
        link: linkFunc,
        controller: EbpTreeTableNodeController,
        controllerAs: '$node'
    };

    return directive;
}

function initNode($scope, $element, $compile, $timeout, $q) {
    'ngInject';
    let node = $scope.node;
    let treeTable = $scope.$ebpTreeTable;
    let events = treeTable.events;
    this.render = () => {
        let tpl = `<td class="ebp-tt-index-cell"><%- index+1%></td>
                   <td class="ebp-tt-level-cell"><%- levelNum%></td>`;
        let levelNum = this.levelNum;
        let compiled = _.template(tpl);
        let el = $(compiled({
            index: $element.index(),
            node,
            levelNum
        }));
        $element.html(el);
        renderCell.apply(this, [
            $element,
            treeTable,
            node,
            $compile,
            $scope,
            $q
        ]);
    };
    $timeout(this.render, 0);
    this.edit = () => {
        events.edit(this.adapter);
    };
    this.remove = () => {
        events.remove(this.adapter);
    };

    this.add = () => this.expand().then(data => {
        events.add(this.adapter, data);
    });

    $element.on({
        click: e => {
            e.preventDefault();
            let checkState = !this.checked;
            if(!e.ctrlKey && !e.metaKey) {
                let checkedNodes = angular.extend([], treeTable.checkedNodes);
                let exclude = [];
                if(checkState && e.shiftKey) {
                    if(checkedNodes.length > 0) {
                        let totalNodes = _.sortBy(exclude.concat(checkedNodes, [this]), node => node.$el.index()),
                        [begin, end] = [totalNodes[0], totalNodes[totalNodes.length - 1]];
                        for(let next = begin;next !== end;next = next.$el.next().scope().$node) {
                            if(totalNodes.indexOf(next) < 0) {
                                totalNodes.push(next);
                            }
                        }
                        angular.forEach(totalNodes, node => node.checked = checkState);
                        exclude = totalNodes;
                    }
                }
                angular.forEach(checkedNodes, node => {
                    if(exclude.indexOf(node) < 0) {
                        node.checked = false;
                    }
                });
            }
            this.checked = checkState;
        }
    });
}

function renderCell(el, treeTable, node, $compile, $scope, $q) {
    let colDefs = treeTable.colDefs;
    angular.forEach(colDefs, (col) => {
        let compiled = _.template(`<td><%- node[col.name]%></td>`);
        let elem = $(compiled({
            node,
            col
        }));
        let value = node[col.name];
        if(col.tpl) {
            let contentEl = angular.element('<div>').html(col.tpl);
            elem.html(contentEl);
            let scope = $scope.$new();
            scope.$node = this.adapter;
            $compile(contentEl)(scope);
            $('.fa, .ebp-tt-btn', contentEl).click(event => event.stopPropagation());
            elem.addClass('ebp-tt-func-cell');
        } else {
            if(col.type === 'progressBar') {
                initProgressBar(elem, {
                    value
                });
                elem.addClass('ebp-tt-comp-cell');
            }
            if(col.type === 'crud') {
                let addBtn = $('<a>').addClass('ebp-tt-btn ebp-tt-btn-add').attr('title', '插入');
                let delBtn = $('<a>').addClass('ebp-tt-btn ebp-tt-btn-delete').attr('title', '删除');
                addBtn.click((event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.add();
                });
                delBtn.click(event => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.remove();
                });
                elem.append(addBtn)
                    .append(delBtn);
            }
        }
        if(col.checkable) {
            let checkHandler = $('<label>').addClass('ebp-tt-checkbox');
            let checkbox = $('<input />', {
                type: 'checkbox'
            });
            checkHandler.append(checkbox);
            checkHandler.append('<span>');
            elem.prepend(checkHandler);
            checkbox.on({
                change: () => {
                    this.checked = checkbox.is(':checked');
                }
            });
            checkHandler.click((event) => event.stopPropagation());
        }
        if(col.expandable) {
            let indent = 20 * ($scope.level - 1);
            elem.css({
                'text-indent': indent + 'px'
            });
            let handler = $('<i>').addClass('ebp-tt-expand-handler');
            elem.prepend(handler);
            if(this.expandHandlers instanceof $) {
                this.expandHandlers.add(handler);
            } else {
                this.expandHandlers = $(handler);
            }
            handler.on('click', (event) => {
                event.stopPropagation();
                if(el.is('.open')) {
                    this.collapse();
                } else {
                    this.expand();
                }
            });
            if(!node.isParent) {
                handler.addClass('trans');
            }
            this.expand = recursive => retrieveNodes.apply(this, [recursive]);
            this.retrieve = recursive => retrieveNodes.apply(this, [recursive, true]);
            this.collapse = collapseNodes;
            if(this.expandableCells instanceof $) {
                this.expandableCells.add(elem);
            } else {
                this.expandableCells = elem;
            }
            if(el.data('expand')) {
                this.expand(true);
            }
        }
        el.append(elem);
    });

    function retrieveNodes(recursive, collapse) {
        let deferred = $q.defer();
        if(this.isParent && !this.loaded) {
            treeTable.retrieve(this, recursive, collapse).then(data => {
                deferred.resolve(data);
            });
            this.loaded = true;
        } else {
            if(!collapse) {
                let nodes = recursive?this.descendants:this.$children;
                angular.forEach(nodes, (node) => {
                    node.$el.removeClass('hidden').addClass(recursive?'open':'');
                });
                this.loaded = true;
            }
            deferred.resolve(this.$children);
        }
        el.addClass(collapse?'':'open');
        return deferred.promise;
    }

    function collapseNodes() {
        angular.forEach(this.$children, node => {
            node.$el.addClass('hidden');
            if(node.$children) {
                node.collapse();
            }
        });
        el.removeClass('open');
    }

}

function initProgressBar(cell, settings) {
    let progressbar = new EbpTreeTableProgressbar(settings);
    cell.html(progressbar.el);
}

class EbpTreeTableProgressbar {
    constructor(settings) {
        this.el = $('<div>').addClass('ebp-tt-progressbar');
        this.bar = $('<div>').addClass('ebp-tt-progressbar-inner');
        this.el.append(this.bar);
        this.value = settings.value;
        this.render();
    }

    render() {
        if(this.value > 0) {
            this.bar.show();
        } else {
            this.bar.hide();
        }
        setTimeout(() => {
            this.bar.width(this.value + '%');
        }, 0);
    }

}

class EbpTreeTableNodeController {
    constructor($injector, $scope, $element, $timeout) {
        'ngInject';
        let treeTable = $scope.$ebpTreeTable;
        let checked = false;
        $injector.invoke(initNode, this, {
            $scope,
            $element
        });
        this.$el = $element;
        let adapter = $injector.instantiate(TreeTableNodeAdapter, {$node: this, $scope});
        adapter.constructor.original = this;
        let level = $scope.level;
        let parent = $scope.$parent.$node;
        let loaded = false;
        let id = _.uniqueId('node_');
        Object.defineProperties(this, {
            $id: {
                get: () => id
            },
            data: {
                get: () => $scope.node
            },
            $level: {
                get: () => level,
                set: newLevel => level = newLevel
            },
            loaded: {
                get: () => loaded,
                set: state => loaded = !!state
            },
            $parent: {
                get: () => parent,
                set: p => parent = p
            },
            levelIndex: {
                get: () => {
                    let index = 0;
                    if(!this.$parent) {
                        index = _.indexOf(treeTable.$children, this);
                    } else {
                        index = _.indexOf(this.$parent.$children, this);
                    }
                    return index;
                }
            },
            levelNum: {
                get: () => {
                    let levelNum = '';
                    let parent = this;
                    while(parent) {
                        levelNum = (parent.levelIndex + 1) + '.' + levelNum;
                        parent = parent.$parent;
                    }
                    return levelNum.substring(0, levelNum.length - 1);
                }
            },
            isParent: {
                get: () => this.data.isParent,
                set: state => {
                    if(state) {
                        this.expandHandlers.removeClass('trans');
                    } else {
                        this.expandHandlers.addClass('trans');
                    }
                    this.data.isParent = state;
                }
            },
            checked: {
                get: () => checked,
                set: state => {
                    checked = state;
                    let checkboxes = $('.ebp-tt-checkbox > input', $element);
                    if(checked) {
                        treeTable.checkedNodes.push(this);
                        $element.addClass('checked');
                        checkboxes.prop('checked', true);
                    } else {
                        _.remove(treeTable.checkedNodes, (node) => {
                            return node === this;
                        });
                        $element.removeClass('checked');
                        checkboxes.prop('checked', false);
                    }
                }
            },
            adapter: {
                get: () => adapter
            },
            descendants: {
                get: () => {
                    let children = [].concat(this.$children || []);
                    angular.forEach(children, node => {
                        children.push(...node.descendants);
                    });
                    return children;
                }
            },
            $last: {
                get: () => {
                    if(!angular.isArray(this.$children)) {
                        return false;
                    } else {
                        return this.get(this.$children.length - 1);
                    }
                }
            }
        });
        treeTable.register(this);
        {
            let parent = this.$parent;
            if(parent) {
                this.$parent.$children = this.$parent.$children || [];
                parent.isParent = true;
            } else {
                parent = treeTable;
            }
            let children = parent.$children || [];
            let index = $element.data('index');
            if(angular.isUndefined(index)) {
                index = children.length;
            } else {
                setTimeout(() => {
                    parent.refreshLevelNum();
                }, 0);
            }
            children.splice(index, 0, this);
        }

        $scope.$on('ebp.tt.refreshLevelNum', () => {
            this.$el.find('.ebp-tt-level-cell').text(this.levelNum);
        });

        this.refreshLevelNum = () => {
            angular.forEach([].concat(this.descendants, [this]), node => {
                node.$el.find('.ebp-tt-level-cell').text(node.levelNum);
            });
        };

        this.$destroy = () => {
            $element.remove();
            treeTable.deregister(this);
            $scope.$destroy();
        };

        this.get = i => this.$children?this.$children[i]:null;

        this.exchange = target => {
            if(!target || angular.equals(this, target)) {
                return;
            }
            if(this.$level === target.$level) {
                let index = this.levelIndex;
                if(index < 0) {
                    return;
                }

                let from = this.levelIndex,
                    to = target.levelIndex,
                    n = this.$el.next(),
                    p = target.$el.prev();
                if(from > to) {
                    target.$el.insertBefore(n);
                    this.$el.insertAfter(p);
                } else {
                    target.$el.insertBefore(this.$el);
                    this.$el.insertAfter(p);
                }
                angular.forEach(this.descendants, node => node.updatePosition());
                angular.forEach(target.descendants, node => node.updatePosition());
                if(this.$parent) {
                    this.$parent.$children.splice(from, 1);
                    this.$parent.$children.splice(to, 0, this);
                    this.$parent.refreshLevelNum();
                } else {
                    treeTable.$children.splice(from, 1);
                    treeTable.$children.splice(to, 0, this);
                    treeTable.refreshLevelNum();
                }
                treeTable.reIndex();
            }
        };

        $scope.$on('ebp-tt-node-check', (event, state) => {
            this.checked = state;
        });

        this.updatePosition = () => {
            let index = this.$parent.$el.index() + this.levelIndex;
            if(this.$el.index() < index) {
                index--;
            }
            let n = this.$el.siblings().eq(index);
            this.$el.insertAfter(n);
        };

        this.removeChildren = () => {
            let children = this.$children;
            let subChildren = getSubChildren(children);
            angular.forEach(subChildren, (node) => {
                _.remove(treeTable.data, (item) => {
                    return item.id === node.data.id;
                });
                node.$destroy();
            });
            function getSubChildren(children) {
                let nodes = children;
                angular.forEach(children, (item) => {
                    if(item.$children) {
                        nodes.push(...getSubChildren(item.$children));
                    }
                });
                return nodes;
            }
        };

        this.reIndent = () => {
            angular.forEach([].concat(this.descendants, [this]), node => {
                let indent = 20 * (node.$level - 1);
                $timeout(() => {
                    node.expandableCells.css({
                        'text-indent': indent + 'px'
                    });
                }, 0);
            });
        };

        this.shiftUp = () => {
            if(this.levelIndex < 1) {
                return;
            }
            let target = null;
            if(this.$parent) {
                target = this.$parent.get(this.levelIndex - 1);
            } else {
                target = treeTable.get(this.levelIndex - 1);
            }
            this.exchange(target);
        };

        this.shiftDown = () => {
            let target = null;
            if(this.$parent) {
                target = this.$parent.get(this.levelIndex + 1);
            } else {
                target = treeTable.get(this.levelIndex + 1);
            }
            this.exchange(target);
        };

        this.upgrade = cascade => {
            let target = this.$parent,
                parent = this.$parent,
                grandpa = treeTable;
            if(!parent) {
                return;
            }
            if(cascade && degrade(parent, this.levelIndex, ..._.filter(parent.$children, node => node.levelIndex > this.levelIndex)) || !cascade) {
                if(cascade) {
                    this.expand();
                }
                let index = target.levelIndex + 1;
                if(parent.$parent) {
                    grandpa = parent.$parent;
                }
                this.$level--;
                _.remove(parent.$children, node => node === this);
                grandpa.$children.splice(index, 0 ,this);
                this.$parent = parent.$parent || undefined;
                angular.forEach(this.descendants, node => {
                    node.updatePosition();
                    node.$level--;
                });
                this.reIndent();
                grandpa.refreshLevelNum();
                treeTable.reIndex();
                if(parent.$children.length < 1) {
                    parent.isParent = false;
                }
            }
        };

        this.degrade = beforeFn => {
            if(!beforeFn) {
                beforeFn = (callback) => {
                    callback();
                };
            } else if(!angular.isFunction(beforeFn)) {
                throw new Error(`Expect a function to call, but got a/an ${typeof beforeFn}`);
            }
            let parent = this.$parent || treeTable,
                prev = parent.get(this.levelIndex - 1);
            if(prev) {
                prev.retrieve().then(() => {
                    beforeFn(callback);
                });
            }

            let callback = () => {
                prev.expand().then(() => {
                    if(degrade(parent, this.levelIndex - 1, this)) {
                        this.reIndent();
                        parent.refreshLevelNum();
                        treeTable.reIndex();
                        prev.$el.addClass('open');
                    }
                });
            };
        };

        function degrade(parent, index, ...nodes) {
            if(index < 0) {
                return false;
            }
            let prev = parent.get(index);
            angular.forEach(nodes, node => {
                node.$level++;
                _.remove(parent.$children, n => n === node);
                prev.$children = prev.$children || [];
                prev.$children.push(node);
                node.$parent = prev;
                angular.forEach(node.descendants, node => {
                    node.updatePosition();
                    node.$level++;
                });
            });
            if(!prev.isParent) {
                prev.isParent = !!nodes.length;
                prev.loaded = true;
            }
            return true;
        }

    }

}

class TreeTableNodeAdapter {

    constructor($node, $scope) {
        'ngInject';
        let treeTable = $scope.$ebpTreeTable;
        Object.defineProperties(this, {
            id: {
                get: () => $node.$id
            },
            model: {
                get: () => $node.data
            },
            levelNum: {
                get: () => $node.levelNum
            },
            parent: {
                get: () => {
                    if($node.$parent) {
                        return $node.$parent.adapter;
                    } else {
                        return null;
                    }
                }
            },
            children: {
                get: () => {
                    return _.map($node.$children, node => node.adapter);
                }
            }
        });

        this.update = data => {
            _.merge(this.model, data);
            $node.render();
            if(!$scope.$$phase) {
                $scope.$apply();
            }
        };

        this.insert = (index, newNode) => {
            if(!newNode || $node.$children && index > $node.$children.length) {
                return;
            }
            treeTable.add(index, $node, newNode);
            this.checked = false;
        };

        this.remove = () => {
            let result = _.remove(treeTable.data, item => item.id === this.model.id);
            if(result.length > 0) {
                $node.removeChildren();
                let parent = $node.$parent;
                if(parent) {
                    _.remove(parent.$children, item => item === $node);
                    parent.refreshLevelNum();
                    if(parent.$children.length < 1) {
                        parent.isParent = false;
                    }
                } else {
                    _.remove(treeTable.$children, item => item === $node);
                    treeTable.refreshLevelNum();
                }
                $node.$destroy();
                treeTable.reIndex();
            }
        };

        this.shiftUp = () => $node.shiftUp();

        this.shiftDown = () => $node.shiftDown();

        this.upgrade = () => $node.upgrade();

        this.degrade = beforeFn => $node.degrade(beforeFn);
    }

}

export default NodeDirectiveFactory;