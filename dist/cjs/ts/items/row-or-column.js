"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RowOrColumn = void 0;
const config_1 = require("../config/config");
const splitter_1 = require("../controls/splitter");
const internal_error_1 = require("../errors/internal-error");
const types_1 = require("../utils/types");
const utils_1 = require("../utils/utils");
const content_item_1 = require("./content-item");
const stack_1 = require("./stack");
/** @public */
class RowOrColumn extends content_item_1.ContentItem {
    /** @internal */
    constructor(isColumn, layoutManager, config, 
    /** @internal */
    _rowOrColumnParent) {
        super(layoutManager, config, _rowOrColumnParent, RowOrColumn.createElement(document, isColumn));
        this._rowOrColumnParent = _rowOrColumnParent;
        /** @internal */
        this._splitter = [];
        this.isRow = !isColumn;
        this.isColumn = isColumn;
        this._childElementContainer = this.element;
        this._splitterSize = layoutManager.layoutConfig.dimensions.borderWidth;
        this._splitterGrabSize = layoutManager.layoutConfig.dimensions.borderGrabWidth;
        this._isColumn = isColumn;
        this._dimension = isColumn ? 'height' : 'width';
        this._splitterPosition = null;
        this._splitterMinPosition = null;
        this._splitterMaxPosition = null;
        switch (config.type) {
            case types_1.ItemType.row:
            case types_1.ItemType.column:
                this._configType = config.type;
                break;
            default:
                throw new internal_error_1.AssertError('ROCCCT00925');
        }
    }
    newComponent(componentType, componentState, title, index) {
        const itemConfig = {
            type: 'component',
            componentType,
            componentState,
            title,
        };
        return this.newItem(itemConfig, index);
    }
    addComponent(componentType, componentState, title, index) {
        const itemConfig = {
            type: 'component',
            componentType,
            componentState,
            title,
        };
        return this.addItem(itemConfig, index);
    }
    newItem(itemConfig, index) {
        index = this.addItem(itemConfig, index);
        const createdItem = this.contentItems[index];
        if (content_item_1.ContentItem.isStack(createdItem) && (config_1.ItemConfig.isComponent(itemConfig))) {
            // createdItem is a Stack which was created to hold wanted component.  Return component
            return createdItem.contentItems[0];
        }
        else {
            return createdItem;
        }
    }
    addItem(itemConfig, index) {
        this.layoutManager.checkMinimiseMaximisedStack();
        const resolvedItemConfig = config_1.ItemConfig.resolve(itemConfig);
        const contentItem = this.layoutManager.createAndInitContentItem(resolvedItemConfig, this);
        return this.addChild(contentItem, index, false);
    }
    /**
     * Add a new contentItem to the Row or Column
     *
     * @param contentItem -
     * @param index - The position of the new item within the Row or Column.
     *                If no index is provided the item will be added to the end
     * @param suspendResize - If true the items won't be resized. This will leave the item in
     *                        an inconsistent state and is only intended to be used if multiple
     *                        children need to be added in one go and resize is called afterwards
     *
     * @returns
     */
    addChild(contentItem, index, suspendResize) {
        // contentItem = this.layoutManager._$normalizeContentItem(contentItem, this);
        if (index === undefined) {
            index = this.contentItems.length;
        }
        if (this.contentItems.length > 0) {
            const splitterElement = this.createSplitter(Math.max(0, index - 1)).element;
            if (index > 0) {
                this.contentItems[index - 1].element.insertAdjacentElement('afterend', splitterElement);
                splitterElement.insertAdjacentElement('afterend', contentItem.element);
                if (this.isDocked(index - 1)) {
                    utils_1.setElementDisplayVisibility(this._splitter[index - 1].element, false);
                    utils_1.setElementDisplayVisibility(this._splitter[index].element, true);
                }
            }
            else {
                this.contentItems[0].element.insertAdjacentElement('beforebegin', splitterElement);
                splitterElement.insertAdjacentElement('beforebegin', contentItem.element);
            }
        }
        else {
            this._childElementContainer.appendChild(contentItem.element);
        }
        super.addChild(contentItem, index);
        const newItemSize = (1 / this.contentItems.length) * 100;
        if (suspendResize === true) {
            this.emitBaseBubblingEvent('stateChanged');
            return index;
        }
        for (let i = 0; i < this.contentItems.length; i++) {
            if (this.contentItems[i] === contentItem) {
                contentItem[this._dimension] = newItemSize;
            }
            else {
                const itemSize = this.contentItems[i][this._dimension] *= (100 - newItemSize) / 100;
                this.contentItems[i][this._dimension] = itemSize;
            }
        }
        this.updateSize();
        this.emitBaseBubblingEvent('stateChanged');
        this.validateDocking();
        return index;
    }
    /**
     * Removes a child of this element
     *
     * @param contentItem -
     * @param keepChild - If true the child will be removed, but not destroyed
     *
     */
    removeChild(contentItem, keepChild) {
        const removedItemSize = contentItem[this._dimension];
        const index = this.contentItems.indexOf(contentItem);
        const splitterIndex = Math.max(index - 1, 0);
        if (index === -1) {
            throw new Error('Can\'t remove child. ContentItem is not child of this Row or Column');
        }
        /**
         * Remove the splitter before the item or after if the item happens
         * to be the first in the row/column
         */
        if (this._splitter[splitterIndex]) {
            this._splitter[splitterIndex].destroy();
            this._splitter.splice(splitterIndex, 1);
        }
        if (splitterIndex < this._splitter.length) {
            if (this.isDocked(splitterIndex))
                utils_1.setElementDisplayVisibility(this._splitter[splitterIndex].element, false);
        }
        /**
         * Allocate the space that the removed item occupied to the remaining items
         */
        const dockedCount = this.calculateDockedCount();
        for (let i = 0; i < this.contentItems.length; i++) {
            if (this.contentItems[i] !== contentItem) {
                if (!this.isDocked(i))
                    this.contentItems[i][this._dimension] += removedItemSize / (this.contentItems.length - 1 - dockedCount);
            }
        }
        super.removeChild(contentItem, keepChild);
        if (this.contentItems.length === 1 && this.isClosable === true) {
            const childItem = this.contentItems[0];
            this.contentItems.length = 0;
            this._rowOrColumnParent.replaceChild(this, childItem, true);
            if (this._rowOrColumnParent instanceof RowOrColumn) { // this check not included originally.
                // If Ground, then validateDocking not require
                this._rowOrColumnParent.validateDocking();
            }
        }
        else {
            this.updateSize();
            this.emitBaseBubblingEvent('stateChanged');
            this.validateDocking();
        }
    }
    /**
     * Replaces a child of this Row or Column with another contentItem
     */
    replaceChild(oldChild, newChild) {
        const size = oldChild[this._dimension];
        super.replaceChild(oldChild, newChild);
        newChild[this._dimension] = size;
        this.updateSize();
        this.emitBaseBubblingEvent('stateChanged');
    }
    /**
     * Called whenever the dimensions of this item or one of its parents change
     */
    updateSize() {
        this.updateNodeSize();
        this.updateContentItemsSize();
    }
    /**
     * Dock or undock a child if it posiible
     *
     * @param contentItem -
     * @param mode - Toggle if undefined
     * @param collapsed - After docking
     */
    dock(contentItem, mode, collapsed) {
        if (this.contentItems.length === 1)
            throw new Error('Can\'t dock child when it single');
        const removedItemSize = contentItem[this._dimension];
        // this is wrong - does not reflect the stack and component settings for header.show
        const headerSize = this.layoutManager.layoutConfig.header.show === false ? 0 : this.layoutManager.layoutConfig.dimensions.headerHeight;
        const index = this.contentItems.indexOf(contentItem);
        const splitterIndex = Math.max(index - 1, 0);
        if (index === -1) {
            throw new Error('Can\'t dock child. ContentItem is not child of this Row or Column');
        }
        const isDocked = contentItem.docker.docked;
        if (mode !== undefined && mode === isDocked)
            return;
        if (isDocked) { // undock it
            this._splitter[splitterIndex].element.style.display = '';
            for (let i = 0; i < this.contentItems.length; i++) {
                const newItemSize = contentItem.docker.size;
                if (this.contentItems[i] === contentItem) {
                    contentItem[this._dimension] = newItemSize;
                }
                else {
                    const itemSize = this.contentItems[i][this._dimension] *= (100 - newItemSize) / 100;
                    this.contentItems[i][this._dimension] = itemSize;
                }
            }
            contentItem.setUndocked();
        }
        else { // dock
            if (this.contentItems.length - this.calculateDockedCount() < 2)
                throw new internal_error_1.AssertError('Can\'t dock child when it is last in ' + this.type);
            const autoside = {
                column: {
                    first: types_1.Side.top,
                    last: types_1.Side.bottom,
                },
                row: {
                    first: types_1.Side.left,
                    last: types_1.Side.right,
                }
            };
            const required = autoside[this._configType][index ? 'last' : 'first'];
            if (contentItem.headerSide !== required)
                contentItem.positionHeader(required);
            if (this._splitter[splitterIndex]) {
                utils_1.setElementDisplayVisibility(this._splitter[splitterIndex].element, false);
            }
            const dockedCount = this.calculateDockedCount();
            for (let i = 0; i < this.contentItems.length; i++) {
                if (this.contentItems[i] !== contentItem) {
                    if (!this.isDocked(i))
                        this.contentItems[i][this._dimension] += removedItemSize / (this.contentItems.length - 1 - dockedCount);
                }
                else
                    this.contentItems[i][this._dimension] = 0;
            }
            contentItem.setDocked({
                docked: true,
                dimension: this._dimension,
                size: removedItemSize,
                realSize: RowOrColumn.getElementDimensionSize(contentItem.element, this._dimension) - headerSize,
            });
            if (collapsed) {
                RowOrColumn.setElementDimensionSize(contentItem.childElementContainer, this._dimension, 0);
            }
        }
        contentItem.element.classList.toggle("lm_docked" /* Docked */, contentItem.docker.docked);
        this.updateSize();
        this.emitBaseBubblingEvent('stateChanged');
        this.validateDocking();
    }
    /**
     * Validate if row or column has ability to dock
     * @internal
     */
    validateDocking() {
        var _a;
        const can = this.contentItems.length - this.calculateDockedCount() > 1;
        for (let i = 0; i < this.contentItems.length; ++i) {
            const contentItem = this.contentItems[i];
            if (contentItem instanceof stack_1.Stack) {
                contentItem.setDockable((_a = this.isDocked(i)) !== null && _a !== void 0 ? _a : can);
                contentItem.setRowColumnClosable(can);
            }
        }
    }
    /**
     * Invoked recursively by the layout manager. ContentItem.init appends
     * the contentItem's DOM elements to the container, RowOrColumn init adds splitters
     * in between them
     * @internal
     */
    init() {
        if (this.isInitialised === true)
            return;
        this.updateNodeSize();
        for (let i = 0; i < this.contentItems.length; i++) {
            this._childElementContainer.appendChild(this.contentItems[i].element);
        }
        super.init();
        for (let i = 0; i < this.contentItems.length - 1; i++) {
            this.contentItems[i].element.insertAdjacentElement('afterend', this.createSplitter(i).element);
        }
        for (let i = 0; i < this.contentItems.length; i++) {
            const contentItem = this.contentItems[i];
            // was previously
            // if (this.contentItems[i]._header && this.contentItems[i]._header.docked)
            // I think this.contentItems[i]._header.docked did not exist (and was always undefined) so the below may be wrong
            if (contentItem instanceof stack_1.Stack && contentItem.docker.docked) {
                this.dock(contentItem, true, true);
            }
        }
        this.initContentItems();
    }
    toConfig() {
        const result = {
            type: this.type,
            content: this.calculateConfigContent(),
            width: this.width,
            minWidth: this.minWidth,
            height: this.height,
            minHeight: this.minHeight,
            id: this.id,
            isClosable: this.isClosable,
        };
        return result;
    }
    /** @internal */
    setParent(parent) {
        this._rowOrColumnParent = parent;
        super.setParent(parent);
    }
    /** @internal */
    updateNodeSize() {
        if (this.contentItems.length > 0) {
            this.calculateRelativeSizes();
            this.setAbsoluteSizes();
        }
        this.emitBaseBubblingEvent('stateChanged');
        this.emit('resize');
    }
    /**
     * Turns the relative sizes calculated by calculateRelativeSizes into
     * absolute pixel values and applies them to the children's DOM elements
     *
     * Assigns additional pixels to counteract Math.floor
     * @internal
     */
    setAbsoluteSizes() {
        const sizeData = this.calculateAbsoluteSizes();
        for (let i = 0; i < this.contentItems.length; i++) {
            if (sizeData.additionalPixel - i > 0) {
                sizeData.itemSizes[i]++;
            }
            if (this._isColumn) {
                utils_1.setElementWidth(this.contentItems[i].element, sizeData.totalWidth);
                utils_1.setElementHeight(this.contentItems[i].element, sizeData.itemSizes[i]);
            }
            else {
                utils_1.setElementWidth(this.contentItems[i].element, sizeData.itemSizes[i]);
                utils_1.setElementHeight(this.contentItems[i].element, sizeData.totalHeight);
            }
        }
    }
    /**
     * Calculates the absolute sizes of all of the children of this Item.
     * @returns Set with absolute sizes and additional pixels.
     * @internal
     */
    calculateAbsoluteSizes() {
        const totalSplitterSize = (this.contentItems.length - 1) * this._splitterSize;
        const headerSize = this.layoutManager.layoutConfig.dimensions.headerHeight;
        let { width: totalWidth, height: totalHeight } = utils_1.getElementWidthAndHeight(this.element);
        if (this._isColumn) {
            totalHeight -= totalSplitterSize;
        }
        else {
            totalWidth -= totalSplitterSize;
        }
        for (let i = 0; i < this.contentItems.length; i++) {
            if (this.isDocked(i)) {
                if (this._isColumn) {
                    totalHeight -= headerSize - this._splitterSize;
                }
                else {
                    totalWidth -= headerSize - this._splitterSize;
                }
            }
        }
        let totalAssigned = 0;
        const itemSizes = [];
        for (let i = 0; i < this.contentItems.length; i++) {
            let itemSize;
            if (this._isColumn) {
                itemSize = Math.floor(totalHeight * (this.contentItems[i].height / 100));
            }
            else {
                itemSize = Math.floor(totalWidth * (this.contentItems[i].width / 100));
            }
            if (this.isDocked(i))
                itemSize = headerSize;
            totalAssigned += itemSize;
            itemSizes.push(itemSize);
        }
        const additionalPixel = Math.floor((this._isColumn ? totalHeight : totalWidth) - totalAssigned);
        return {
            itemSizes: itemSizes,
            additionalPixel: additionalPixel,
            totalWidth: totalWidth,
            totalHeight: totalHeight
        };
    }
    /**
     * Calculates the relative sizes of all children of this Item. The logic
     * is as follows:
     *
     * - Add up the total size of all items that have a configured size
     *
     * - If the total == 100 (check for floating point errors)
     *        Excellent, job done
     *
     * - If the total is \> 100,
     *        set the size of items without set dimensions to 1/3 and add this to the total
     *        set the size off all items so that the total is hundred relative to their original size
     *
     * - If the total is \< 100
     *        If there are items without set dimensions, distribute the remainder to 100 evenly between them
     *        If there are no items without set dimensions, increase all items sizes relative to
     *        their original size so that they add up to 100
     *
     * @internal
     */
    calculateRelativeSizes() {
        let total = 0;
        const itemsWithoutSetDimension = [];
        for (let i = 0; i < this.contentItems.length; i++) {
            if (this.contentItems[i][this._dimension] !== undefined) {
                total += this.contentItems[i][this._dimension];
            }
            else {
                itemsWithoutSetDimension.push(this.contentItems[i]);
            }
        }
        /**
         * Everything adds up to hundred, all good :-)
         */
        if (Math.round(total) === 100) {
            this.respectMinItemWidth();
            return;
        }
        /**
         * Allocate the remaining size to the items without a set dimension
         */
        if (Math.round(total) < 100 && itemsWithoutSetDimension.length > 0) {
            for (let i = 0; i < itemsWithoutSetDimension.length; i++) {
                itemsWithoutSetDimension[i][this._dimension] = (100 - total) / itemsWithoutSetDimension.length;
            }
            this.respectMinItemWidth();
            return;
        }
        /**
         * If the total is > 100, but there are also items without a set dimension left, assing 50
         * as their dimension and add it to the total
         *
         * This will be reset in the next step
         */
        if (Math.round(total) > 100) {
            for (let i = 0; i < itemsWithoutSetDimension.length; i++) {
                itemsWithoutSetDimension[i][this._dimension] = 50;
                total += 50;
            }
        }
        /**
         * Set every items size relative to 100 relative to its size to total
         */
        for (let i = 0; i < this.contentItems.length; i++) {
            this.contentItems[i][this._dimension] = (this.contentItems[i][this._dimension] / total) * 100;
        }
        this.respectMinItemWidth();
    }
    /**
     * Adjusts the column widths to respect the dimensions minItemWidth if set.
     * @internal
     */
    respectMinItemWidth() {
        const minItemWidth = this.layoutManager.layoutConfig.dimensions.minItemWidth;
        let totalOverMin = 0;
        let totalUnderMin = 0;
        const entriesOverMin = [];
        const allEntries = [];
        if (this._isColumn || !minItemWidth || this.contentItems.length <= 1) {
            return;
        }
        const sizeData = this.calculateAbsoluteSizes();
        /**
         * Figure out how much we are under the min item size total and how much room we have to use.
         */
        for (let i = 0; i < sizeData.itemSizes.length; i++) {
            const itemSize = sizeData.itemSizes[i];
            let entry;
            if (itemSize < minItemWidth) {
                totalUnderMin += minItemWidth - itemSize;
                entry = {
                    width: minItemWidth
                };
            }
            else {
                totalOverMin += itemSize - minItemWidth;
                entry = {
                    width: itemSize
                };
                entriesOverMin.push(entry);
            }
            allEntries.push(entry);
        }
        /**
         * If there is nothing under min, or there is not enough over to make up the difference, do nothing.
         */
        if (totalUnderMin === 0 || totalUnderMin > totalOverMin) {
            return;
        }
        /**
         * Evenly reduce all columns that are over the min item width to make up the difference.
         */
        const reducePercent = totalUnderMin / totalOverMin;
        let remainingWidth = totalUnderMin;
        for (let i = 0; i < entriesOverMin.length; i++) {
            const entry = entriesOverMin[i];
            const reducedWidth = Math.round((entry.width - minItemWidth) * reducePercent);
            remainingWidth -= reducedWidth;
            entry.width -= reducedWidth;
        }
        /**
         * Take anything remaining from the last item.
         */
        if (remainingWidth !== 0) {
            allEntries[allEntries.length - 1].width -= remainingWidth;
        }
        /**
         * Set every items size relative to 100 relative to its size to total
         */
        for (let i = 0; i < this.contentItems.length; i++) {
            this.contentItems[i].width = (allEntries[i].width / sizeData.totalWidth) * 100;
        }
    }
    /**
     * Instantiates a new Splitter, binds events to it and adds
     * it to the array of splitters at the position specified as the index argument
     *
     * What it doesn't do though is append the splitter to the DOM
     *
     * @param index - The position of the splitter
     *
     * @returns
     * @internal
     */
    createSplitter(index) {
        const splitter = new splitter_1.Splitter(this._isColumn, this._splitterSize, this._splitterGrabSize);
        splitter.on('drag', (offsetX, offsetY) => this.onSplitterDrag(splitter, offsetX, offsetY));
        splitter.on('dragStop', () => this.onSplitterDragStop(splitter));
        splitter.on('dragStart', () => this.onSplitterDragStart(splitter));
        this._splitter.splice(index, 0, splitter);
        return splitter;
    }
    /**
     * Locates the instance of Splitter in the array of
     * registered splitters and returns a map containing the contentItem
     * before and after the splitters, both of which are affected if the
     * splitter is moved
     *
     * @returns A map of contentItems that the splitter affects
     * @internal
     */
    getItemsForSplitter(splitter) {
        const index = this._splitter.indexOf(splitter);
        return {
            before: this.contentItems[index],
            after: this.contentItems[index + 1]
        };
    }
    /** @internal */
    isDocked(index) {
        if (index >= this.contentItems.length) {
            return false;
        }
        else {
            const contentItem = this.contentItems[index];
            if (contentItem instanceof stack_1.Stack) {
                return contentItem.docker.docked;
            }
            else {
                return false;
            }
        }
    }
    /** @internal */
    calculateDockedCount() {
        let count = 0;
        for (let i = 0; i < this.contentItems.length; ++i)
            if (this.isDocked(i))
                count++;
        return count;
    }
    /**
     * Gets the minimum dimensions for the given item configuration array
     * @internal
     */
    getMinimumDimensions(arr) {
        var _a, _b;
        let minWidth = 0;
        let minHeight = 0;
        for (let i = 0; i < arr.length; ++i) {
            minWidth = Math.max((_a = arr[i].minWidth) !== null && _a !== void 0 ? _a : 0, minWidth);
            minHeight = Math.max((_b = arr[i].minHeight) !== null && _b !== void 0 ? _b : 0, minHeight);
        }
        return {
            horizontal: minWidth,
            vertical: minHeight
        };
    }
    /**
     * Invoked when a splitter's dragListener fires dragStart. Calculates the splitters
     * movement area once (so that it doesn't need calculating on every mousemove event)
     * @internal
     */
    onSplitterDragStart(splitter) {
        const items = this.getItemsForSplitter(splitter);
        const minSize = this.layoutManager.layoutConfig.dimensions[this._isColumn ? 'minItemHeight' : 'minItemWidth'];
        const beforeMinDim = this.getMinimumDimensions(items.before.contentItems);
        const beforeMinSize = this._isColumn ? beforeMinDim.vertical : beforeMinDim.horizontal;
        const afterMinDim = this.getMinimumDimensions(items.after.contentItems);
        const afterMinSize = this._isColumn ? afterMinDim.vertical : afterMinDim.horizontal;
        this._splitterPosition = 0;
        this._splitterMinPosition = -1 * (utils_1.pixelsToNumber(items.before.element.style[this._dimension]) - (beforeMinSize || minSize));
        this._splitterMaxPosition = utils_1.pixelsToNumber(items.after.element.style[this._dimension]) - (afterMinSize || minSize);
    }
    /**
     * Invoked when a splitter's DragListener fires drag. Updates the splitters DOM position,
     * but not the sizes of the elements the splitter controls in order to minimize resize events
     *
     * @param splitter -
     * @param offsetX - Relative pixel values to the splitters original position. Can be negative
     * @param offsetY - Relative pixel values to the splitters original position. Can be negative
     * @internal
     */
    onSplitterDrag(splitter, offsetX, offsetY) {
        const offset = this._isColumn ? offsetY : offsetX;
        if (this._splitterMinPosition === null || this._splitterMaxPosition === null) {
            throw new internal_error_1.UnexpectedNullError('ROCOSD59226');
        }
        else {
            if (offset > this._splitterMinPosition && offset < this._splitterMaxPosition) {
                this._splitterPosition = offset;
                const offsetPixels = utils_1.numberToPixels(offset);
                if (this._isColumn) {
                    splitter.element.style.top = offsetPixels;
                }
                else {
                    splitter.element.style.left = offsetPixels;
                }
            }
        }
    }
    /**
     * Invoked when a splitter's DragListener fires dragStop. Resets the splitters DOM position,
     * and applies the new sizes to the elements before and after the splitter and their children
     * on the next animation frame
     * @internal
     */
    onSplitterDragStop(splitter) {
        if (this._splitterPosition === null) {
            throw new internal_error_1.UnexpectedNullError('ROCOSDS66932');
        }
        else {
            const items = this.getItemsForSplitter(splitter);
            const sizeBefore = utils_1.pixelsToNumber(items.before.element.style[this._dimension]);
            const sizeAfter = utils_1.pixelsToNumber(items.after.element.style[this._dimension]);
            const splitterPositionInRange = (this._splitterPosition + sizeBefore) / (sizeBefore + sizeAfter);
            const totalRelativeSize = items.before[this._dimension] + items.after[this._dimension];
            items.before[this._dimension] = splitterPositionInRange * totalRelativeSize;
            items.after[this._dimension] = (1 - splitterPositionInRange) * totalRelativeSize;
            splitter.element.style.top = utils_1.numberToPixels(0);
            splitter.element.style.left = utils_1.numberToPixels(0);
            globalThis.requestAnimationFrame(() => this.updateSize());
        }
    }
}
exports.RowOrColumn = RowOrColumn;
/** @public */
(function (RowOrColumn) {
    /** @internal */
    function getElementDimensionSize(element, dimension) {
        if (dimension === 'width') {
            return utils_1.getElementWidth(element);
        }
        else {
            return utils_1.getElementHeight(element);
        }
    }
    RowOrColumn.getElementDimensionSize = getElementDimensionSize;
    /** @internal */
    function setElementDimensionSize(element, dimension, value) {
        if (dimension === 'width') {
            return utils_1.setElementWidth(element, value);
        }
        else {
            return utils_1.setElementHeight(element, value);
        }
    }
    RowOrColumn.setElementDimensionSize = setElementDimensionSize;
    /** @internal */
    function createElement(document, isColumn) {
        const element = document.createElement('div');
        element.classList.add("lm_item" /* Item */);
        if (isColumn) {
            element.classList.add("lm_column" /* Column */);
        }
        else {
            element.classList.add("lm_row" /* Row */);
        }
        return element;
    }
    RowOrColumn.createElement = createElement;
})(RowOrColumn = exports.RowOrColumn || (exports.RowOrColumn = {}));
//# sourceMappingURL=row-or-column.js.map