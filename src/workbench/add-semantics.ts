import fs from 'fs-extra';
import modifyHtmls from './modifyHtmls';
import documentGroups from '../../data/document-groups.json';

const addSemantics = async () => {
  const result = await modifyHtmls('./.cache/sanitized-html', './public/html', () => {
    const changeTagName = (element: Element, tagName: string, dropAttribute?: boolean) => {
      const newElement = document.createElement(tagName);
      newElement.innerHTML = element.innerHTML;
      if (!dropAttribute)
        for (let i = 0; i < element.attributes.length; i += 1)
          newElement.setAttribute(element.attributes[i].name, element.attributes[i].value);
      element.parentElement?.insertBefore(newElement, element);
      element.remove();
      return newElement as Element;
    };

    document.querySelectorAll('br').forEach(q => q.remove());

    document.body.querySelectorAll('span').forEach(q => {
      if (
        parseInt(window.getComputedStyle(q).fontSize, 10) > 13.3333 &&
        q.textContent !== '• ' &&
        q.nextElementSibling &&
        !(q.nextElementSibling as HTMLElement).style.fontSize &&
        q.parentElement?.children[0] === q
      ) {
        q.removeAttribute('style');
        changeTagName(q.nextElementSibling, 'small');
        changeTagName(q.parentElement, 'h3', true);
      }
    });

    let title = '';
    document.body.querySelectorAll('div').forEach(q => {
      const fontSizeValue = (q as HTMLElement)?.style.fontSize;
      const fontSize = fontSizeValue ? parseInt(fontSizeValue, 10) : 13.3333;
      if (fontSize >= 24 && !title) {
        changeTagName(q, 'h1', true);
        title = q.textContent || '';
      } else if (fontSize >= 24) changeTagName(q, 'h2', true);
      else if (fontSize >= 16 && fontSize < 24) changeTagName(q, 'h3', true);
      else if (fontSize > 13.3333 && fontSize < 15) changeTagName(q, 'h4', true);
      else if (q.querySelectorAll('div,p,table').length === 0) {
        let cursor: HTMLElement | null = q.parentElement;
        while (cursor && cursor.tagName !== 'TABLE') cursor = cursor.parentElement;
        const inTable = cursor?.tagName === 'TABLE';
        if (q.style.length === 1 && q.style.fontWeight === '700' && !inTable) changeTagName(q, 'h5', true);
        else if (!inTable) changeTagName(q, 'p');
      }
    });
    if (title) document.title = title;

    document.body.querySelectorAll('td').forEach(q => {
      q.removeAttribute('width');
      q.removeAttribute('valign');
    });

    document.querySelectorAll('h1,h2,h3,h4,h5').forEach((headline, key) => {
      const slug = headline
        .textContent!.trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-+$|^-+/g, '');

      headline.id = `${headline.tagName.toLowerCase()}-${key}-${slug}`;
    });

    document.querySelectorAll<HTMLHeadingElement>('h1,h2,h3,h4,h5').forEach(headline => {
      const level = parseInt(headline.tagName.substr(1), 10);
      const stopperSelector = Array.from(Array(level), (_, n) => `H${n + 1}`);
      const section = document.createElement('section');
      while (headline.nextElementSibling && stopperSelector.indexOf(headline.nextElementSibling.tagName) === -1)
        section.appendChild(headline.nextElementSibling);
      const { id } = headline;
      headline.removeAttribute('id');
      section.id = id;
      headline.insertAdjacentElement('beforebegin', section);
      section.insertAdjacentElement('afterbegin', headline);
    });

    return Array.from(document.querySelectorAll('[id]'), element => {
      const headline = (element.tagName === 'SECTION'
        ? element.querySelector('h1,h2,h3,h4,h5')
        : element) as HTMLElement;

      return {
        id: element.id,
        textContent:
          headline.textContent
            ?.trim()
            .toLowerCase()
            .replace(/\s+/, ' ')
            .replace(/(^\w{1})|([^a-zA-Z]\w{1})/g, match => match.toUpperCase())
            .replace(/\b(i{1,3}|iv|vi{0,3})\b/gi, match => match.toUpperCase()) || '',
        hnum: parseInt(headline.tagName.substr(1), 10),
      };
    });
  });

  const anchorResult = documentGroups.flatMap(({ groupName, pages }) => {
    return pages.flatMap(page => {
      return result[page.href].map(v => ({
        ...v,
        filename: page.href,
        href: `${page.href}#${v.id}`,
        groupName,
      }));
    });
  });

  fs.writeJSONSync('./data/anchors.json', anchorResult);
};

export default addSemantics;
